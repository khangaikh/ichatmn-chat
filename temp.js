var request = require('request');
		// Set the headers
		var headers = {
		    'Key':       'sdhjkshdkhsdjkfhsjkd',
		    'Content-Type':     'application/x-www-form-urlencoded'
		}

		// Configure the request
		var options = {
		    url: 'http://localhost:8889',
		    method: 'POST',
		    headers: headers
		}

		// Start the request
		request(options, function (error, response, body) {
		    if (!error && response.statusCode == 200) {
		        // Print out the response body
		        console.log(body)
		    }
		});


var crypto = require('crypto'),
	    			algorithm = 'aes-256-ctr',
	    			password = 'd6F3Efeq';

	  				var cipher = crypto.createCipher(algorithm,password);
	  				var symmetric_key = cipher.update(params.roomID,'utf8','hex');
	  				symmetric_key += cipher.final('hex');

					/*Game play started*/
					console.log('Encrypt with Public');

					var msg1 = crt.encrypt(file.name, 'utf8', 'base64');
		
					console.log('Encrypt with Private (called public)');
					msg = keyPair.privateEncrypt(params.roomID, 'utf8', 'base64');
					
					mkdirp(kds, function(err) { 
					    console.log('Check directory.');
					});
					
					var encrypted = encrypt(params.roomID, keySizeBits/8, keyPair);
					console.log(encrypted);


		secrets.init(20);
					var cipher = crypto.createCipher(algorithm,password);
	  				var crypted = cipher.update(file.name,'utf8','hex');
	  				crypted += cipher.final('hex')

	  				crypted_final = symmetric_key+"694c6f76654d6f6e676f6c6961"+crypted;

	  				console.log(crypted_final);
	  				
	  				console.time("queryTime");
					var shares = secrets.share(crypted_final, 5, 2); 
					console.timeEnd("queryTime");

					for(var i=0; i<5; i++){

						var filePath= host_server+'/'+ external_hosts[i]+'/'+params.roomID;

						mkdirp(filePath, function(err) { 
						    console.log('External host contacted directory.');
						});
						var fileWrite = filePath+'/'+i+".txt";

						fs.writeFile(fileWrite, shares[i], function(err) {
						    if(err) {
						        return console.log(err);
						    }
						});
						console.log("Secret share item saved on KDS");
					}

					var cipher = crypto.createCipher(algorithm,password)
  					var crypted = Buffer.concat([cipher.update(file.buffer),cipher.final()]);
			    	
					var filePath= kds+'/'+'file.pub';

					fs.writeFile(filePath, crypted, function(err) {
					    if(err) {
					        return console.log(err);
					    }    
					});

			    	console.log('File saved.');
			    	socket.emit("update_msg", "fileexeptions*"+params.roomID);