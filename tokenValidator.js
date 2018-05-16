'use strict';

var jwt = require('jsonwebtoken');
var config = require('./config');
var jwtSecret = process.env.JWT_SECRET;

module.exports = function (req, res, next) {
    var token = req.body.token || req.query.token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, jwtSecret, function (err, decoded) {
            if (err) {
                return res.send({
                    error: true,
                    message: err
                })
            }
            req.decoded = decoded;
            next();
        });
    } else {
        return res.status(204).send({
            error: true,
            message: "No Token Provided"
        })
    }
};