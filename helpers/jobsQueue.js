let jobsQueue = {

	jobs: {},

	register: function (name, job, time) {
		if (this.jobs[name]) {
			throw new Error('Synchronous job ' + name  + ' already registered');
		}

		let nextJob = function () {
			return job(function () {
				jobsQueue.jobs[name] = setTimeout(nextJob, time);
			});
		};

		nextJob();
		return this.jobs[name];
	}

};

module.exports = jobsQueue;

/*************************************** END OF FILE *************************************/
