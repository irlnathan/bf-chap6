/**
 * UserController
 *
 * @description :: Server-side logic for managing users
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */

var Emailaddresses = require('machinepack-emailaddresses');
var Passwords = require('machinepack-passwords');
var Gravatar = require('machinepack-gravatar');

module.exports = {

  signup: function(req, res) {

    // Validate parameters
    if (_.isUndefined(req.param('email'))) {
      return res.badRequest('An email address is required!');
    }

    if (_.isUndefined(req.param('password'))) {
      return res.badRequest('A password is required!');
    }

    if (req.param('password').length < 6) {
      return res.badRequest('Password must be at least 6 characters!');
    }

    if (_.isUndefined(req.param('username'))) {
      return res.badRequest('A username is required!');
    }

    // replace any white spaces in username with underscores
    var splitUsername = req.param('username').split(' ').join('-');

    // var user = {
    //   email: req.param('email'),
    //   username: splitUsername,
    //   password: req.param('password')
    // };

    // return res.json(user);


    // Determine whether or not the provided string is an email address.
    Emailaddresses.validate({
      string: req.param('email'),
    }).exec({
      // An unexpected error occurred.
      error: function(err) {
        return res.serverError(err);
      },
      // The provided string is not an email address.
      invalid: function() {
        return res.badRequest('Doesn\'t look like an email address to me!');
      },
      // OK.
      success: function() {

        // var user = {
        //   email: req.param('email'),
        //   username: splitUsername,
        //   password: req.param('password')
        // };

        // return res.json(user);

        // // Encrypt req.param('password') using the BCrypt algorithm.
        Passwords.encryptPassword({
          password: req.param('password'),
        }).exec({
          // An unexpected error occurred.
          error: function(err) {
            return res.serverError(err);
          },
          // OK.
          success: function(result) {

            // var user = {
            //   email: req.param('email'),
            //   username: splitUsername,
            //   password: req.param('password'),
            //   encryptedPassword: result
            // };

            // return res.json(user);

            var options = {};

            try {
              // Build the URL of a gravatar image for req.param('email').
              options.gravatarURL = Gravatar.getImageUrl({
                emailAddress: req.param('email')
              }).execSync();

            } catch (err) {
              return res.serverError(err);
            }

            // var user = {
            //   email: req.param('email'),
            //   username: splitUsername,
            //   password: req.param('password'),
            //   encryptedPassword: result,
            //   gravatarURL: options.gravatarURL
            // };

            // return res.json(user);

            //Build up the user options dictionary
            options.email = req.param('email');
            options.encryptedPassword = result;
            options.username = splitUsername;
            options.deleted = false;
            options.admin = false;
            options.banned = false;

            User.create(options).exec(function(err, createdUser) {

              if (err) {

                // If this is a uniqueness error about the email attribute,
                // send back an easily parseable status code.
                if (err.invalidAttributes && err.invalidAttributes.email && err.invalidAttributes.email[0] && err.invalidAttributes.email[0].rule === 'unique') {
                  return res.alreadyInUse(err);
                }

                // If this is a uniqueness error about the username attribute,
                // send back an easily parseable status code.
                if (err.invalidAttributes && err.invalidAttributes.username && err.invalidAttributes.username[0] && err.invalidAttributes.username[0].rule === 'unique') {
                  return res.alreadyInUse(err);
                }

                // // If this is a uniqueness error about the email attribute,
                // // send back an easily parseable status code.
                // if (err.invalidAttributes && err.invalidAttributes.email && err.invalidAttributes.email[0] && err.invalidAttributes.email[0].rule === 'unique') {
                //   // return res.alreadyInUse(err);
                //   return res.send(409, 'Email address is already taken by another user, please try again.');
                // }

                // // If this is a uniqueness error about the username attribute,
                // // send back an easily parseable status code.
                // if (err.invalidAttributes && err.invalidAttributes.username && err.invalidAttributes.username[0] && err.invalidAttributes.username[0].rule === 'unique') {
                //   // return res.alreadyInUse(err);
                //   return res.send(409, 'Username is already taken by another user, please try again.');
                // }

                // Otherwise, send back something reasonable as our error response.
                return res.negotiate(err);
              }

              // On a successful creation of a user send the user record as json with
              // a 200 status.
              return res.json(createdUser);

            });
          }
        });
      },
    });
  },

  profile: function(req, res) {

    // Try to look up user using the provided email address
    User.findOne(req.param('id'),
      function foundUser(err, user) {
        // Handle error
        if (err) return res.negotiate(err);

        // Handle no user being found
        if (!user) return res.notFound();

        // Return the user
        return res.json(user);
      });
  },

  delete: function(req, res) {

    // Validate for id
    if (!req.param('id')) {
      return res.badRequest('id is a required parameter.');
    }

    // Destroy record permanently
    User.destroy({
      id: req.param('id')
    }).exec(function(err, usersDestroyed) {
      if (err) return res.negotiate(err);
      if (usersDestroyed.length === 0) {
        return res.notFound();
      }

      // Send back a 200 status
      return res.ok();
    });
  },

  removeProfile: function(req, res) {

    // Validate for id
    if (!req.param('id')) {
      return res.badRequest('id is a required parameter.');
    }

    User.update({
      id: req.param('id')
    }, {
      deleted: true
    }, function(err, removedUser) {

      if (err) return res.negotiate(err);
      if (removedUser.length === 0) {
        return res.notFound();
      }

      // Send back a 200 status
      return res.ok();
    });
  },

  restoreProfile: function(req, res) {

    // Try to look up user using the provided email address
    User.findOne({
      email: req.param('email')
    }, function foundUser(err, user) {
      if (err) return res.negotiate(err);
      if (!user) return res.notFound();

      // Compare password attempt from the form params to the encrypted password
      // from the database (`user.password`)
      Passwords.checkPassword({
        passwordAttempt: req.param('password'),
        encryptedPassword: user.encryptedPassword
      }).exec({

        error: function(err) {
          return res.negotiate(err);
        },

        // If the password from the form params doesn't checkout w/ the encrypted
        // password from the database...
        incorrect: function() {
          return res.notFound();
        },

        success: function() {

          User.update({
            id: user.id
          }, {
            deleted: false
          }).exec(function(err, updatedUser) {

            return res.json(updatedUser);
          });
        }
      });
    });
  },

  restoreGravatarURL: function(req, res) {

    // Create a Gravatar URL using the passed in email address

    try {
      // Build the URL of a gravatar image for a particular email address.
      var restoredGravatarURL = gravatarURL = Gravatar.getImageUrl({
        emailAddress: req.param('email')
      }).execSync();

      return res.json(restoredGravatarURL);

    } catch (err) {
      return res.serverError(err);
    }
  },

  updateProfile: function(req, res) {

    User.update({
      id: req.param('id')
    }, {
      gravatarURL: req.param('gravatarURL')
    }, function(err, updatedUser) {

      // Handle error
      if (err) return res.negotiate(err);

      // Return updated User
      return res.json(updatedUser);

    });
  },

  changePassword: function(req, res) {

    // Validate password

    if (_.isUndefined(req.param('password'))) {
      return res.badRequest('A password is required!');
    }

    if (req.param('password').length < 6) {
      return res.badRequest('Password must be at least 6 characters!');
    }

    // Encrypt a string using the BCrypt algorithm.
    Passwords.encryptPassword({
      password: req.param('password'),
    }).exec({
      // An unexpected error occurred.
      error: function(err) {

        return res.serverError(err);

      },
      // OK.
      success: function(result) {

        // console.log('the result: ', result);
        // console.log('req.param: ', req.param('id'))

        User.update({
          id: req.param('id')
        }, {
          encryptedPassword: result
        }).exec(function(err, updatedUser) {
          if (err) {
            return res.negotiate(err);
          }

          return res.json(updatedUser);

        });

      },
    });


    // return res.ok();

  },

  adminUsers: function(req, res) {

    // Return an array of all user record dictionaries
    User.find().exec(function(err, users){

      if (err) return res.negotiate(err);

      return res.json(users);

    });

  },

  updateAdmin: function(req, res) {

    User.update(req.param('id'), {
      admin: req.param('admin')
    }).exec(function(err, update){

     if (err) return res.negotiate(err);

      res.ok();

    });

  },

  updateBanned: function(req, res) {

    User.update(req.param('id'), {
      banned: req.param('banned')
    }).exec(function(err, update){

     if (err) return res.negotiate(err);

      res.ok();

    });

  },

  updateDeleted: function(req, res) {

    User.update(req.param('id'), {
      deleted: req.param('deleted')
    }).exec(function(err, update){

     if (err) return res.negotiate(err);

      res.ok();

    });

  },

  me: function(req, res) {

    var id = req.param('id');

    User.findOne(req.param('id')).exec(function(err, me) {

      console.log(me);

      res.json(me);

    });
  },

  checkPassword: function(req, res) {

    var id = req.param('id');

    User.findOne(req.param('id')).exec(function(err, me) {

      console.log(me);

      // Compare a plaintext password attempt against an already-encrypted version.
      Passwords.checkPassword({
        passwordAttempt: req.param('password'),
        encryptedPassword: me.encryptedPassword,
      }).exec({
        // An unexpected error occurred.
        error: function(err) {

          return res.serverError(err);

        },
        // Password attempt does not match already-encrypted version
        incorrect: function() {

          return res.badRequest('nope');

        },
        // OK.
        success: function() {

          return res.ok();

        },
      });
    });
  }
};