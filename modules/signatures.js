

let constants = require('../helpers/constants.js');
let crypto = require('crypto');
let sandboxHelper = require('../helpers/sandbox.js');
let schema = require('../schema/signatures.js');
let Signature = require('../logic/signature.js');
let transactionTypes = require('../helpers/transactionTypes.js');

// Private fields
let modules, library, self, __private = {}, shared = {};

__private.assetTypes = {};

/**
 * Initializes library with scope content and generates a Signature instance.
 * Calls logic.transaction.attachAssetType().
 * @memberof module:signatures
 * @class
 * @classdesc Main signatures methods.
 * @param {function} cb - Callback function.
 * @param {scope} scope - App instance.
 * @return {setImmediateCallback} Callback function with `self` as data.
 */
// Constructor
function Signatures (cb, scope) {
	library = {
		schema: scope.schema,
		ed: scope.ed,
		balancesSequence: scope.balancesSequence,
		logic: {
			transaction: scope.logic.transaction,
		},
	};
	self = this;

	__private.assetTypes[transactionTypes.SIGNATURE] = library.logic.transaction.attachAssetType(
		transactionTypes.SIGNATURE,
		new Signature(
			scope.schema,
			scope.logger
		)
	);

	setImmediate(cb, null, self);
}

// Public methods
/**
 * Checks if `modules` is loaded.
 * @return {boolean} True if `modules` is loaded.
 */
Signatures.prototype.isLoaded = function () {
	return !!modules;
};

/**
 * Calls helpers.sandbox.callMethod().
 * @implements module:helpers#callMethod
 * @param {function} call - Method to call.
 * @param {} args - List of arguments.
 * @param {function} cb - Callback function.
 */
Signatures.prototype.sandboxApi = function (call, args, cb) {
	sandboxHelper.callMethod(shared, call, args, cb);
};

// Events
/**
 * Calls Signature.bind() with modules params.
 * @implements module:signatures#Signature~bind
 * @param {modules} scope - Loaded modules.
 */
Signatures.prototype.onBind = function (scope) {
	modules = {
		accounts: scope.accounts,
		transactions: scope.transactions,
	};

	__private.assetTypes[transactionTypes.SIGNATURE].bind(
		scope.accounts
	);
};

// Shared API
/**
 * @todo implement API comments with apidoc.
 * @see {@link http://apidocjs.com/}
 */
Signatures.prototype.shared = {
	getFee: function (req, cb) {
		let fee = constants.fees.secondsignature;

		return setImmediate(cb, null, {fee: fee});
	},

	addSignature: function (req, cb) {
		library.schema.validate(req.body, schema.addSignature, function (err) {
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
				if (req.body.multisigAccountPublicKey && req.body.multisigAccountPublicKey !== keypair.publicKey.toString('hex')) {
					modules.accounts.getAccount({publicKey: req.body.multisigAccountPublicKey}, function (err, account) {
						if (err) {
							return setImmediate(cb, err);
						}

						if (!account || !account.publicKey) {
							return setImmediate(cb, 'Multisignature account not found');
						}

						if (!account.multisignatures || !account.multisignatures) {
							return setImmediate(cb, 'Account does not have multisignatures enabled');
						}

						if (account.multisignatures.indexOf(keypair.publicKey.toString('hex')) < 0) {
							return setImmediate(cb, 'Account does not belong to multisignature group');
						}

						if (account.secondSignature || account.u_secondSignature) {
							return setImmediate(cb, 'Account already has a second passphrase');
						}

						modules.accounts.getAccount({publicKey: keypair.publicKey}, function (err, requester) {
							if (err) {
								return setImmediate(cb, err);
							}

							if (!requester || !requester.publicKey) {
								return setImmediate(cb, 'Requester not found');
							}

							if (requester.secondSignature && !req.body.secondSecret) {
								return setImmediate(cb, 'Missing requester second passphrase');
							}

							if (requester.publicKey === account.publicKey) {
								return setImmediate(cb, 'Invalid requester public key');
							}

							let secondHash = crypto.createHash('sha256').update(req.body.secondSecret, 'utf8').digest();
							let secondKeypair = library.ed.makeKeypair(secondHash);
							let transaction;

							library.logic.transaction.create({
								type: transactionTypes.SIGNATURE,
								sender: account,
								keypair: keypair,
								requester: keypair,
								secondKeypair: secondKeypair
							}).then((transactionSignature) => {
								transaction = transactionSignature;
								modules.transactions.receiveTransactions([transaction], true, cb);
							}).catch((e) => {
								return setImmediate(cb, e.toString());
							});
						});
					});
				} else {
					modules.accounts.setAccountAndGet({publicKey: keypair.publicKey.toString('hex')}, function (err, account) {
						if (err) {
							return setImmediate(cb, err);
						}

						if (!account || !account.publicKey) {
							return setImmediate(cb, 'Account not found');
						}

						if (account.secondSignature || account.u_secondSignature) {
							return setImmediate(cb, 'Account already has a second passphrase');
						}

						let secondHash = crypto.createHash('sha256').update(req.body.secondSecret, 'utf8').digest();
						let secondKeypair = library.ed.makeKeypair(secondHash);
						let transaction;

						library.logic.transaction.create({
							type: transactionTypes.SIGNATURE,
							sender: account,
							keypair: keypair,
							secondKeypair: secondKeypair
						}).then((transactionSignature) => {
							transaction = transactionSignature;
							modules.transactions.receiveTransactions([transaction], true, cb);
						}).catch((e) => {
							return setImmediate(cb, e.toString());
						});
					});
				}

			}, function (err, transaction) {
				if (err) {
					return setImmediate(cb, err);
				}
				return setImmediate(cb, null, {transaction: transaction[0]});
			});

		});
	}
};

// Export
module.exports = Signatures;

/*************************************** END OF FILE *************************************/
