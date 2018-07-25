
let constants = require('../helpers/constants.js');
let sql = require('../sql/frogings.js');
let slots = require('../helpers/slots.js');
let StakeReward = require('../logic/stakeReward.js');
let request = require('request');
let async = require('async');
let Promise = require('bluebird');
let rewards = require('../helpers/rewards');
let reward_sql = require('../sql/referal_sql');
let env = process.env;
let cache = require('../modules/cache');

let __private = {};
__private.types = {};
let modules, library, self;

/**
 * Main Frozen logic.
 * @memberof module:frogings
 * @class
 * @classdesc Main Frozen logic.
 * @param {Object} logger
 * @param {Dataabase} db
 * @param {Transaction} transaction
 * @param {Network} network
 * @param {Object} config
 * @param {function} cb - Callback function.
 * @return {setImmediateCallback} With `this` as data.
 */
// Constructor
function Frozen(logger, db, transaction, network, config, cb) {
	self = this;
	self.scope = {
		logger: logger,
		db: db,
		logic: {
			transaction: transaction
		},
		network: network,
		config: config
	};

	if (cb) {
		return setImmediate(cb, null, this);
	}
}

// Private methods
/**
 * Creates a stakeReward instance.
 * @private
 */
__private.stakeReward = new StakeReward();

/**
 * create stake_orders table records
 * @param {Object} data - stake order data
 * @param {Object} trs - transaction data
 * @returns {trs} trs
 */
Frozen.prototype.create = function (data, trs) {
	trs.startTime = trs.timestamp;
	let date = new Date(trs.timestamp * 1000);
	trs.recipientId = null;
	trs.stakedAmount = data.freezedAmount;
	trs.nextVoteMilestone = (date.setMinutes(date.getMinutes() + constants.froze.vTime)) / 1000;
	trs.trsName = "STAKE";
	return trs;
};

/**
 * @desc on modules ready
 * @private
 * @implements 
 * @param {Object} sender - sender data
 * @param {Object} frz - stake order data
 * @param {function} cb - Callback function.
 * @return {bool} true
 */
Frozen.prototype.ready = function (frz, sender) {
	return true;
};

/**
 * @desc stake_order table name
 */
Frozen.prototype.dbTable = 'stake_orders';

/**
 * @desc stake_order table fields
 */
Frozen.prototype.dbFields = [
	"id",
	"status",
	"startTime",
	"insertTime",
	"senderId",
	"recipientId",
	"freezedAmount",
	"nextVoteMilestone"
];

Frozen.prototype.inactive = '0';
Frozen.prototype.active = '1';

/**
 * Creates db object transaction to `stake_orders` table.
 * @param {trs} trs
 * @return {Object} created object {table, fields, values}
 * @throws {error} catch error
 */
Frozen.prototype.dbSave = function (trs) {
	return {
		table: this.dbTable,
		fields: this.dbFields,
		values: {
			id: trs.id,
			status: this.active,
			startTime: trs.startTime,
			insertTime: trs.startTime,
			senderId: trs.senderId,
			recipientId: trs.recipientId,
			freezedAmount: trs.stakedAmount,
			nextVoteMilestone: trs.nextVoteMilestone
		}
	};
};

/**
 * Creates froze object based on raw data.
 * @param {Object} raw
 * @return {null|froze} blcok object
 */
Frozen.prototype.dbRead = function (raw) {
	return null;
};

/**
 * @param {trs} trs
 * @return {error|transaction} error string | trs normalized
 * @throws {string|error} error message | catch error
 */
Frozen.prototype.objectNormalize = function (trs) {
	delete trs.blockId;
	return trs;
};

/**
 * @desc undo unconfirmed transations
 * @private
 * @implements 
 * @param {Object} sender - sender data
 * @param {Object} trs - transation data
 * @param {function} cb - Callback function.
 * @return {function} cb
 */
Frozen.prototype.undoUnconfirmed = function (trs, sender, cb) {
	return setImmediate(cb);
};

/**
 * @desc apply unconfirmed transations
 * @private
 * @implements 
 * @param {Object} sender - sender data
 * @param {Object} trs - transation data
 * @param {function} cb - Callback function.
 * @return {function} cb
 */
Frozen.prototype.applyUnconfirmed = function (trs, sender, cb) {
	return setImmediate(cb);
};

/**
 * @private
 * @implements 
 * @param {Object} block - block data
 * @param {Object} sender - sender data
 * @param {Object} trs - transation data
 * @param {function} cb - Callback function.
 * @return {function} {cb, err}
 */
Frozen.prototype.undo = function (trs, block, sender, cb) {

	self.scope.db.none(sql.RemoveOrder,
		{
			id: trs.id,
			address: trs.senderId
		})
		.then(function () {
			self.scope.db.none(sql.deductFrozeAmount,
				{
					senderId: trs.senderId,
					FrozeAmount:trs.stakedAmount
				})
				.then(function () {
					return setImmediate(cb);
				})
				.catch(function (err) {
					self.scope.logger.error(err.stack);
					return setImmediate(cb, 'Stake#DeductStakeAmount from mem_account error');
				});
		})
		.catch(function (err) {
			self.scope.logger.error(err.stack);
			return setImmediate(cb, 'Stake#deleteOrder error');
		});
};

/**
 * @desc apply
 * @private
 * @implements 
 *  @param {Object} block - block data
 * @param {Object} sender - sender data
 * @param {Object} trs - transation data
 * @param {function} cb - Callback function.
 * @return {function} cb
 */
Frozen.prototype.apply = function (trs, block, sender, cb) {
	return setImmediate(cb, null, trs);
};

/**
 * @desc get bytes
 * @private
 * @implements 
 * @return {null}
 */
Frozen.prototype.getBytes = function (trs) {
	return null;
};

/**
 * @desc process transaction
 * @private
 * @implements 
 * @param {Object} sender - sender data
 * @param {Object} trs - transation data
 * @param {function} cb - Callback function.
 * @return {function} cb
 */
Frozen.prototype.process = function (trs, sender, cb) {
	return setImmediate(cb, null, trs);
};

/**
 * @desc verify
 * @private
 * @implements 
 * @param {Object} sender - sender data
 * @param {Object} trs - transation data
 * @param {function} cb - Callback function.
 * @return {function} {cb, err, trs}
 */
Frozen.prototype.verify = function (trs, sender, cb) {
	let amount = trs.stakedAmount / 100000000;

	if (amount < 1) {
		return setImmediate(cb, 'Invalid stake amount');
	}

	if((amount%1)!= 0){
		return setImmediate(cb, 'Invalid stake amount: Decimal value');
	}

	return setImmediate(cb, null, trs);
};

/**
 * @desc calculate fee for transaction type 9
 * @private
 * @param {Object} sender - sender data
 * @param {Object} trs - transation data
 * @return % based on amount
 */
Frozen.prototype.calculateFee = function (trs, sender) {
	return (trs.stakedAmount * constants.fees.froze) / 100;
};

/**
 * @desc on bine
 * @private
 * @implements 
 * @param {Object} accounts - modules:accounts
 */
Frozen.prototype.bind = function (accounts, rounds, blocks) {
	modules = {
		accounts: accounts,
		rounds: rounds,
		blocks: blocks
	};
};


Frozen.prototype.sendStakingReward = function (address, reward_amount, cb) {

	let sponsor_address = address;
	let amount = reward_amount;
	let overrideReward = {};
	let i = 0;
	let balance, reward, sender_balance;

	self.scope.db.query(reward_sql.referLevelChain, {
		address: sponsor_address
	}).then(function (user) {

		if (user.length != 0 && user[0].level != null) {

			let chain_length = user[0].level.length;

			async.eachSeries(user[0].level, function (level, callback) {

				overrideReward[level] = (((rewards.level[i]) * amount) / 100);

				let transactionData = {
					json: {
						secret: env.SENDER_SECRET,
						amount: overrideReward[level],
						recipientId: level,
						transactionRefer: 11
					}
				};

				self.scope.logic.transaction.sendTransaction(transactionData, function (err, transactionResponse) {
					if (err) return err;
					i++;

					if(transactionResponse.body.success == false) {
                        sender_balance = parseFloat(transactionResponse.body.error.split('balance:')[1]);
						if(sender_balance < 0.0001) {
							cache.prototype.setJsonForKey("referStatus", false);
							self.scope.logger.info("Staking Reward Info : "+ transactionResponse.body.error);													
							return setImmediate(cb,null);
						}
					} else {
						reward = true;
					}
						
					if(i == chain_length && reward != true) {
						self.scope.logger.info("Staking Reward Info : "+ transactionResponse.body.error);						
					}

					callback();
				});

			}, function (err) {
				if (err) {
					return setImmediate(cb, err);
				}
				return setImmediate(cb, null);
			});

		} else {
			self.scope.logger.info("Staking Reward Info : Referral chain is empty");
			return setImmediate(cb, null);
		}

	}).catch(function (err) {
		return setImmediate(cb, err);
	});
}



/**
 * @desc checkFrozeOrders
 * @private
 * @implements {Frozen#getfrozeOrders}
 * @implements {Frozen#checkAndUpdateMilestone}
 * @implements {Frozen#deductFrozeAmountandSendReward}
 * @implements {Frozen#disableFrozeOrders}
 * @return {Promise} {Resolve|Reject}
 */
Frozen.prototype.checkFrozeOrders = function () {


	function getfrozeOrders(next) {

		self.scope.db.query(sql.getfrozeOrder,
			{
				milestone: constants.froze.vTime * 60,
				currentTime: slots.getTime()
			}).then(function (freezeOrders) {
				if (freezeOrders.length > 0) {
					self.scope.logger.info("Successfully get :" + freezeOrders.length + ", number of froze order");
				
				}
				if(freezeOrders.length==0){
					next(null, []);
				}else{
					next(null, freezeOrders);
				}
				
			}).catch(function (err) {
				self.scope.logger.error(err);
				next(err, null);
			});
	}

	function checkAndUpdateMilestone(next, freezeOrders) {
		if (freezeOrders.length > 0) {
			//emit Stake order event when milestone change
			self.scope.network.io.sockets.emit('milestone/change', null);

			//Update nextMilesone in "stake_orders" table
			self.scope.db.none(sql.checkAndUpdateMilestone,
				{
					milestone: constants.froze.vTime * 60,
					currentTime: slots.getTime()
				})
				.then(function () {
					next(null, freezeOrders);
				})
				.catch(function (err) {
					self.scope.logger.error(err.stack);
					next(err, null);
				});
		} else {
			next(null, freezeOrders);
		}

	}

	function deductFrozeAmountandSendReward(next, freezeOrders) {
		if (freezeOrders.length > 0) {

			async.eachSeries(freezeOrders, function (order, eachSeriesCb) {

				updateOrderAndSendReward(order, function (err, Success) {
					if (err) {
						eachSeriesCb(err);
						//next(err, null);
					} else {
						deductFrozeAmount(order, function (_err, _Success) {
							if (_err) {
								eachSeriesCb(_err);
								// next(_err, null);
							} else {
								async.setImmediate(eachSeriesCb);
							}
						});
					}
				});

			}, function (err) {
				next(err, freezeOrders);
			});

		} else {
			next(null, freezeOrders);
		}
	}

	function updateOrderAndSendReward(order, next) {

			if (order.voteCount === (constants.froze.milestone / constants.froze.vTime)) {

				self.scope.db.none(sql.updateOrder, {
					senderId: order.senderId,
					id: order.stakeId
				}).then(function () {
					//Request to send transaction
					let transactionData = {
						json: {
							secret: self.scope.config.sender.secret,
							amount: parseInt(order.freezedAmount * __private.stakeReward.calcReward(modules.blocks.lastBlock.get().height) / 100),
							recipientId: order.senderId,
							publicKey: self.scope.config.sender.publicKey
						}
					};
					//Send froze monthly rewards to users
					self.scope.logic.transaction.sendTransaction(transactionData, function (error, transactionResponse) {
						if (error)
							throw error;
						else {

							self.scope.db.one(reward_sql.checkBalance, {
								sender_address: env.SENDER_ADDRESS
							}).then(function (bal) {
								let balance = parseInt(bal.u_balance);
								if (balance > 10000) {
									self.sendStakingReward(order.senderId, transactionData.json.amount, function (err) {
										if (err) {
											self.scope.logger.error(err.stack);
										}

										self.scope.logger.info("Successfully transfered reward for freezing an amount and transaction ID is : " + transactionResponse.body.transactionId);
										next(null, null);
									});
								} else {
									cache.prototype.isExists("referStatus",function(err,exist){
										if(!exist) {
											cache.prototype.setJsonForKey("referStatus", false);
										}
										self.scope.logger.info("Successfully transfered reward for freezing an amount and transaction ID is : " + transactionResponse.body.transactionId);
										next(null, null);
									});
								}
							}).catch(function (err) {
								next(err, null);
							});

						}
					});
				}).catch(function (err) {
					self.scope.logger.error(err.stack);
					next(err, null);
				});
			} else {
				next(null, null);
			}
	}

	function deductFrozeAmount(order, _next) {

			if (((order.rewardCount + 1) >= (constants.froze.endTime / constants.froze.milestone)) && (order.voteCount === (constants.froze.milestone / constants.froze.vTime))) {

				self.scope.db.none(sql.deductFrozeAmount, {
					FrozeAmount: order.freezedAmount,
					senderId: order.senderId
				}).then(function () {
					_next(null, null);
				}).catch(function (err) {
					self.scope.logger.error(err.stack);
					_next(err, null);
				});
			} else {
				_next(null, null);
			}
	}

	function disableFrozeOrder(next, freezeOrders) {
		if (freezeOrders.length > 0) {
			//change status and nextmilestone
			self.scope.db.none(sql.disableFrozeOrders,
				{
					currentTime: slots.getTime(),
					totalMilestone: constants.froze.endTime / constants.froze.milestone
				})
				.then(function () {
					self.scope.logger.info("Successfully check status for disable froze orders");
					next(null, null);


				})
				.catch(function (err) {
					self.scope.logger.error(err.stack);
					next(err, null);
				});
		} else {
			next(null, null);
		}
	}

	async.auto({
		getfrozeOrders: function (next) {
			getfrozeOrders(next)
		},
		checkAndUpdateMilestone: ['getfrozeOrders', function (results, next) {
			checkAndUpdateMilestone(next, results.getfrozeOrders);
		}],
		deductFrozeAmountandSendReward: ['checkAndUpdateMilestone', function (results, next) {
			deductFrozeAmountandSendReward(next, results.getfrozeOrders);
		}],
		disableFrozeOrder: ['deductFrozeAmountandSendReward', function (results, next) {
			disableFrozeOrder(next, results.getfrozeOrders)
		}]
	}, function (err, results) {
		if (err)
			self.scope.logger.error(err);
	})

};

/**
 * @desc updateFrozeAmount
 * @private
 * @param {Object} userData - user data
 * @param {function} cb - Callback function.
 * @return {function} {cb, err}
 */
Frozen.prototype.updateFrozeAmount = function (userData, cb) {

	self.scope.db.one(sql.getFrozeAmount, {
		senderId: userData.account.address
	})
		.then(function (totalFrozeAmount) {
			if (!totalFrozeAmount) {
				return setImmediate(cb, 'No Account Exist in mem_account table for' + userData.account.address);
			}
			let frozeAmountFromDB = totalFrozeAmount.totalFrozeAmount;
			totalFrozeAmount = parseInt(frozeAmountFromDB) + userData.freezedAmount;
			let totalFrozeAmountWithFees = totalFrozeAmount + (parseFloat(constants.fees.froze) * (userData.freezedAmount)) / 100;
			if (totalFrozeAmountWithFees <= userData.account.balance) {
				self.scope.db.none(sql.updateFrozeAmount, {
					freezedAmount: userData.freezedAmount,
					senderId: userData.account.address
				})
					.then(function () {
						self.scope.logger.info(userData.account.address, ': is update its froze amount in mem_accounts table ');
						return setImmediate(cb, null);
					})
					.catch(function (err) {
						self.scope.logger.error(err.stack);
						return setImmediate(cb, err.toString());
					});
			} else {
				return setImmediate(cb, 'Not have enough balance');
			}
		})
		.catch(function (err) {
			self.scope.logger.error(err.stack);
			return setImmediate(cb, err.toString());
		});

};

// Export
module.exports = Frozen;

/*************************************** END OF FILE *************************************/
