// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool, euint8, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title VaultWagerGame
/// @notice Dice wagering experience that keeps player balances and dice rolls encrypted through Zama's FHEVM.
contract VaultWagerGame is ZamaEthereumConfig {
    /// @notice Stores the encrypted dice and guess information for the latest round played by a user.
    struct RoundResult {
        euint8 diceOne;
        euint8 diceTwo;
        euint8 total;
        ebool guessedBig;
        ebool wasCorrect;
    }

    /// @notice Stores the last encrypted error code with the timestamp when it occurred.
    struct LastError {
        euint8 code;
        uint256 timestamp;
    }

    uint256 public constant POINTS_PER_ETH = 1000;
    uint64 public constant ROUND_REWARD = 10;
    uint8 private constant DICE_SIDES = 6;
    uint8 private constant DICE_SHIFT = 1;
    uint8 private constant BIG_THRESHOLD = 7;

    error DepositTooSmall();
    error PointsOverflow();

    mapping(address => euint64) private _balances;
    mapping(address => RoundResult) private _lastRound;
    mapping(address => LastError) private _lastErrors;

    euint8 private immutable _noError;
    euint8 private immutable _insufficientBalance;

    event PointsPurchased(address indexed player, uint256 depositedWei, uint64 pointsMinted);
    event RoundPlayed(
        address indexed player,
        bytes32 diceOne,
        bytes32 diceTwo,
        bytes32 total,
        bytes32 guessedBig,
        bytes32 wasCorrect
    );

    constructor() {
        _noError = FHE.asEuint8(0);
        _insufficientBalance = FHE.asEuint8(1);
        FHE.allowThis(_noError);
        FHE.allowThis(_insufficientBalance);
    }

    /// @notice Converts deposited ETH into encrypted points (1 ETH = 1000 points).
    /// @dev Returns the updated encrypted balance so relayers can decrypt in a single call.
    function purchasePoints() external payable returns (euint64) {
        uint64 mintedPoints = _convertEthToPoints(msg.value);
        if (mintedPoints == 0) {
            revert DepositTooSmall();
        }

        euint64 currentBalance = _getInitializedBalance(msg.sender);
        euint64 minted = FHE.asEuint64(mintedPoints);
        euint64 updated = FHE.add(currentBalance, minted);

        _balances[msg.sender] = updated;
        _shareEncryptedValue(updated, msg.sender);
        _setLastError(msg.sender, _noError);

        emit PointsPurchased(msg.sender, msg.value, mintedPoints);
        return updated;
    }

    /// @notice Rolls two encrypted dice and applies the +/-10 point rule based on the guess.
    /// @param guessBig true for "Big" (total >= 7) guesses, false for "Small".
    /// @return The encrypted round metadata that was stored for the caller.
    function playRound(bool guessBig) external returns (RoundResult memory) {
        address player = msg.sender;

        euint64 balance = _getInitializedBalance(player);
        (RoundResult memory swing, euint64 newBalance, ebool insufficientLoss) = _simulateRound(balance, guessBig);

        _balances[player] = newBalance;
        _shareEncryptedValue(newBalance, player);

        RoundResult storage round = _lastRound[player];
        round.diceOne = _shareDie(swing.diceOne, player);
        round.diceTwo = _shareDie(swing.diceTwo, player);
        round.total = _shareDie(swing.total, player);
        round.guessedBig = _shareBool(swing.guessedBig, player);
        round.wasCorrect = _shareBool(swing.wasCorrect, player);

        euint8 errorCode = FHE.select(insufficientLoss, _insufficientBalance, _noError);
        _setLastError(player, errorCode);

        emit RoundPlayed(
            player,
            euint8.unwrap(round.diceOne),
            euint8.unwrap(round.diceTwo),
            euint8.unwrap(round.total),
            ebool.unwrap(round.guessedBig),
            ebool.unwrap(round.wasCorrect)
        );

        return RoundResult(round.diceOne, round.diceTwo, round.total, round.guessedBig, round.wasCorrect);
    }

    /// @notice Returns the encrypted balance that belongs to `player`.
    function getEncryptedBalance(address player) external view returns (euint64) {
        return _balances[player];
    }

    /// @notice Returns encrypted dice outcome, guess and correctness for the last round played by `player`.
    function getLastRound(address player) external view returns (RoundResult memory) {
        return _lastRound[player];
    }

    /// @notice Returns the last encrypted error code and timestamp for `player`.
    function getLastError(address player) external view returns (LastError memory) {
        return _lastErrors[player];
    }

    /// @notice Current ETH holdings of the contract treasury.
    function contractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function _rollDie() private returns (euint8) {
        return FHE.add(FHE.rem(FHE.randEuint8(), DICE_SIDES), FHE.asEuint8(DICE_SHIFT));
    }

    function _convertEthToPoints(uint256 weiAmount) private pure returns (uint64) {
        uint256 points = (weiAmount * POINTS_PER_ETH) / 1 ether;
        if (points > type(uint64).max) {
            revert PointsOverflow();
        }
        return uint64(points);
    }

    function _simulateRound(
        euint64 balance,
        bool guessBig
    ) private returns (RoundResult memory swing, euint64 newBalance, ebool insufficientLoss) {
        euint8 diceOne = _rollDie();
        euint8 diceTwo = _rollDie();
        euint8 total = FHE.add(diceOne, diceTwo);

        ebool guessedBigEnc = FHE.asEbool(guessBig);
        ebool thresholdMatch = FHE.ge(total, FHE.asEuint8(BIG_THRESHOLD));
        ebool isCorrect = FHE.eq(guessedBigEnc, thresholdMatch);

        euint64 step = FHE.asEuint64(ROUND_REWARD);
        euint64 deduction = FHE.select(FHE.ge(balance, step), step, balance);
        euint64 winOutcome = FHE.add(balance, step);
        euint64 lossOutcome = FHE.sub(balance, deduction);

        swing.diceOne = diceOne;
        swing.diceTwo = diceTwo;
        swing.total = total;
        swing.guessedBig = guessedBigEnc;
        swing.wasCorrect = isCorrect;

        newBalance = FHE.select(isCorrect, winOutcome, lossOutcome);
        ebool insufficient = FHE.ne(deduction, step);
        insufficientLoss = FHE.and(FHE.not(isCorrect), insufficient);
    }

    function _getInitializedBalance(address player) private returns (euint64) {
        euint64 stored = _balances[player];
        if (!FHE.isInitialized(stored)) {
            stored = FHE.asEuint64(0);
        }
        return stored;
    }

    function _setLastError(address player, euint8 code) private {
        LastError storage state = _lastErrors[player];
        state.code = _shareByte(code, player);
        state.timestamp = block.timestamp;
    }

    function _shareEncryptedValue(euint64 value, address player) private {
        FHE.allowThis(value);
        FHE.allow(value, player);
    }

    function _shareDie(euint8 value, address player) private returns (euint8) {
        FHE.allowThis(value);
        FHE.allow(value, player);
        return value;
    }

    function _shareBool(ebool value, address player) private returns (ebool) {
        FHE.allowThis(value);
        FHE.allow(value, player);
        return value;
    }

    function _shareByte(euint8 value, address player) private returns (euint8) {
        FHE.allowThis(value);
        FHE.allow(value, player);
        return value;
    }
}
