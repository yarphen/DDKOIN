

let crypto = require('crypto');
let schema = require('../schema/frogings.js');
let sql = require('../sql/frogings.js');
let TransactionPool = require('../logic/transactionPool.js');
let transactionTypes = require('../helpers/transactionTypes.js');
let Frozen = require('../logic/frozen.js');
let ref_sql = require('../sql/referal_sql');
let constants = require('../helpers/constants.js');
let cache = require('./cache.js');
let slots = require('../helpers/slots');

// Private fields
let __private = {};
let shared = {};
let modules;
let library;
let self;

__private.assetTypes = {};

/**
 * Initializes library with scope content and generates a Transfer instance
 * and a TransactionPool instance.
 * Calls logic.transaction.attachAssetType().
 * @memberof module:transactions
 * @class
 * @classdesc Main transactions methods.
 * @param {function} cb - Callback function.
 * @param {scope} scope - App instance.
 * @return {setImmediateCallback} Callback function with `self` as data.
 */
// Constructor
function Frogings (cb, scope) {
	library = {
		logger: scope.logger,
		db: scope.db,
		cache: scope.cache,
		schema: scope.schema,
		ed: scope.ed,
		balancesSequence: scope.balancesSequence,
		logic: {
			transaction: scope.logic.transaction,
			frozen: scope.logic.frozen
		},
		genesisblock: scope.genesisblock,
		network: scope.network,
		config: scope.config
	};

	self = this;

	__private.transactionPool = new TransactionPool(
		scope.config.broadcasts.broadcastInterval,
		scope.config.broadcasts.releaseLimit,
		scope.config.transactions.maxTxsPerQueue,
		scope.logic.transaction,
		scope.bus,
		scope.logger
	);

	__private.assetTypes[transactionTypes.STAKE] = library.logic.transaction.attachAssetType(
		transactionTypes.STAKE, new Frozen(scope.logger, scope.db, scope.logic.transaction, scope.network, scope.config, scope.balancesSequence, scope.ed)
	);

	setImmediate(cb, null, self);
}

/**
 * Direct introducer reward.
 * 10 percent of Reward send to the Direct introducer for staking the amount by it's sponsor.
 * Reward is send through the main account.
 * Disable refer option when main account balance becomes zero.
 * @param {reward} number - reward for referral user
 * @param {address} string - Address of user which staked the amount.
 * @param {introducerAddress} string - Address of user which get reward and introduce address to ddk.
 * @param {transactionId} string - stake transaction id.
 * @author - Satish Joshi 
 */

// Events
/**
 * Bounds scope to private transactionPool and modules
 * to private Transfer instance.
 * @implements module:transactions#Transfer~bind
 * @param {scope} scope - Loaded modules.
 */
Frogings.prototype.onBind = function (scope) {
	modules = {
		accounts: scope.accounts,
		transactions: scope.transactions
	};

	__private.transactionPool.bind(
		scope.accounts,
		scope.transactions,
		scope.loader
	);
	__private.assetTypes[transactionTypes.STAKE].bind(
		scope.accounts,
		scope.rounds,
		scope.blocks,
		scope.transactions
	);

};


// Shared API
/**
 * @todo implement API comments with apidoc.
 * @see {@link http://apidocjs.com/}
 */
Frogings.prototype.shared = {

	countStakeholders: function (req, cb) {

		library.db.one(sql.countStakeholders)
		.then(function (row) {
			return setImmediate(cb, null, {
				countStakeholders: row
			});
		})
		.catch(function (err) {
			return setImmediate(cb, err);
		});

	},

	totalDDKStaked: function (req, cb) {
		library.db.one(sql.getTotalStakedAmount)
		.then(function (row) {
			return setImmediate(cb, null, {
				totalDDKStaked: row
			});
		})
		.catch(function (err) {
			return setImmediate(cb, err);
		});
	},

	getMyDDKFrozen: function (req, cb) {
		library.schema.validate(req.body, schema.getMyDDKFrozen, function (err) {
			if (err) {
				return setImmediate(cb, err[0].message);
			}
			let hash = crypto.createHash('sha256').update(req.body.secret, 'utf8').digest();
			let keypair = library.ed.makeKeypair(hash);

			modules.accounts.getAccount({ publicKey: keypair.publicKey.toString('hex') }, function (err, account) {
				if (!account || !account.address) {
					return setImmediate(cb, 'Address of account not found');
				}

				library.db.one(sql.getMyStakedAmount, { address: account.address })
				.then(function (row) {
					return setImmediate(cb, null, {
						totalDDKStaked: row
					});
				})
				.catch(function (err) {
					return setImmediate(cb, err);
				});
			});
		});
	},
	
	getAllFreezeOrders: function (req, cb) {

		library.schema.validate(req.body, schema.getAllFreezeOrder, function (err) {
			if (err) {
				return setImmediate(cb, err[0].message);
			}
			let hash = crypto.createHash('sha256').update(req.body.secret, 'utf8').digest();
			let keypair = library.ed.makeKeypair(hash);

			modules.accounts.getAccount({ publicKey: keypair.publicKey.toString('hex') }, function (err, account) {
				if (!account || !account.address) {
					return setImmediate(cb, 'Address of account not found');
				}

				library.db.query(sql.getFrozeOrders, { senderId: account.address })
				.then(function (rows) {
					return setImmediate(cb, null, {
						freezeOrders: JSON.stringify(rows)
					});
				})
				.catch(function (err) {
					return setImmediate(cb, err);
				});
			});
		});
	},

	getAllActiveFreezeOrders: function (req, cb) {


		library.schema.validate(req.body, schema.getAllActiveFreezeOrder, function (err) {
			if (err) {
				return setImmediate(cb, err[0].message);
			}
			let hash = crypto.createHash('sha256').update(req.body.secret, 'utf8').digest();
			let keypair = library.ed.makeKeypair(hash);

			modules.accounts.getAccount({ publicKey: keypair.publicKey.toString('hex') }, function (err, account) {
				if (!account || !account.address) {
					return setImmediate(cb, 'Address of account not found');
				}
				
				library.db.one(sql.getActiveFrozeOrders, { senderId: account.address })
				.then(function (rows) {
					return setImmediate(cb, null, {
						freezeOrders: JSON.stringify(rows)
					});
				})
				.catch(function (err) {
					return setImmediate(cb, err);
				});

			});
		});
	},

	addTransactionForFreeze: function (req, cb) {

		let accountData;
		library.schema.validate(req.body, schema.addTransactionForFreeze, function (err) {
			if (err) {
				return setImmediate(cb, err[0].message);
			}

			let hash = crypto.createHash('sha256').update(req.body.secret, 'utf8').digest();
			let keypair = library.ed.makeKeypair(hash);

			if (req.body.publicKey) {
				if (keypair.publicKey.toString('hex') !== req.body.publicKey) {
					return setImmediate(cb, 'Invalid passphrase');
				}
			}

			library.balancesSequence.add(function (cb) {
				if (
					req.body.multisigAccountPublicKey &&
					req.body.multisigAccountPublicKey !== keypair.publicKey.toString('hex')
				) {
					modules.accounts.getAccount({ publicKey: req.body.multisigAccountPublicKey }, (err, account) => {
						if (err) {
							return setImmediate(cb, err);
						}
						accountData = account;

						if (!account || !account.publicKey) {
							return setImmediate(cb, 'Multisignature account not found');
						}

						if (!account.multisignatures || !account.multisignatures) {
							return setImmediate(cb, 'Account does not have multisignatures enabled');
						}

						if (account.multisignatures.indexOf(keypair.publicKey.toString('hex')) < 0) {
							return setImmediate(cb, 'Account does not belong to multisignature group');
						}

						modules.accounts.getAccount({ publicKey: keypair.publicKey }, function (err, requester) {
							if (err) {
								return setImmediate(cb, err);
							}

							if (!requester || !requester.publicKey) {
								return setImmediate(cb, 'Requester not found');
							}

							if (requester.secondSignature && !req.body.secondSecret) {
								return setImmediate(cb, 'Missing second passphrase');
							}

							if (requester.publicKey === account.publicKey) {
								return setImmediate(cb, 'Invalid requester public key');
							}

							let secondKeypair = null;

							if (requester.secondSignature) {
								let secondHash = crypto.createHash('sha256').update(req.body.secondSecret, 'utf8').digest();
								secondKeypair = library.ed.makeKeypair(secondHash);
							}

							if (
								(
									req.body.freezedAmount +
									(constants.fees.froze * req.body.freezedAmount)/100 +
									parseInt(account.totalFrozeAmount)
								) > account.balance
							) {
								return setImmediate(cb, 'Insufficient balance');
							}

							library.logic.transaction.create({
								type: transactionTypes.STAKE,
								freezedAmount: req.body.freezedAmount,
								sender: account,
								keypair: keypair,
								secondKeypair: secondKeypair,
								requester: keypair
							}).then((transactionStake) => {
								modules.transactions.receiveTransactions([transactionStake], true, cb);
							}).catch((e) => {
								return setImmediate(cb, e.toString());
							});
						});

					});
				} else {
					modules.accounts.setAccountAndGet({ publicKey: keypair.publicKey.toString('hex') }, function (err, account) {
						if (err) {
							return setImmediate(cb, err);
						}
						accountData = account;
						if (!account || !account.publicKey) {
							return setImmediate(cb, 'Account not found');
						}

						if (account.secondSignature && !req.body.secondSecret) {
							return setImmediate(cb, 'Missing second passphrase');
						}

						let secondKeypair = null;

						if (account.secondSignature) {
							let secondHash = crypto.createHash('sha256').update(req.body.secondSecret, 'utf8').digest();
							secondKeypair = library.ed.makeKeypair(secondHash);
						}
						
						if (
							(
								req.body.freezedAmount +
								(constants.fees.froze * req.body.freezedAmount)/100 +
								parseInt(account.totalFrozeAmount)
							) > account.balance
						) {
							return setImmediate(cb, 'Insufficient balance');
						} 

						library.logic.transaction.create({
							type: transactionTypes.STAKE,
							freezedAmount: req.body.freezedAmount,
							sender: account,
							keypair: keypair,
							secondKeypair: secondKeypair
						}).then((transactionStake) => {
							modules.transactions.receiveTransactions([transactionStake], true, cb);
						}).catch((e) => {
							return setImmediate(cb, e.toString());
						});
					});
				}
			}, function (err, transaction) {
				if (err) {
					return setImmediate(cb, err);
				}
				library.network.io.sockets.emit('updateTotalStakeAmount', null);
				return setImmediate(cb, null, {
					transaction: transaction[0],
					referStatus: true
				});
			});
		});
	}
};

// Export
module.exports = Frogings;

/*************************************** END OF FILE *************************************/
