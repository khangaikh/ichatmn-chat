var express = require('express')
, app = express()
, server = require('http').createServer(app)
, io = require("socket.io").listen(server)
, dl  = require('delivery')
, fs  = require('fs')
, npid = require("npid")
, uuid = require('node-uuid')
, Room = require('./room.js')
, _ = require('underscore')._;

var multer  = require('multer');
var done=false;
//var ip_address = 'smb://192.168.0.10/db/ichat.db';
//var ip_address = '/Applications/XAMPP/htdocs/ichatmn-web';
var ip_address = '/opt/lampp/htdocs/ichatmn-web';
var internal = 'localhost';
var ip_run = "192.168.0.10"; //127.0.0.1

app.configure(function() {
	app.set('port', process.env.OPENSHIFT_NODEJS_PORT || 8080);
  	app.set('ipaddr', process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1");
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(express.static(__dirname + '/public'));
	app.use('/components', express.static(__dirname + '/components'));
	app.use('/js', express.static(__dirname + '/js'));
	app.use('/icons', express.static(__dirname + '/icons'));
	app.set('views', __dirname + '/views');
	app.engine('html', require('ejs').renderFile);

	/* Store process-id (as priviledged user) */
	try {
	    npid.create('/var/run/advanced-chat.pid', true);
	} catch (err) {
	    console.log(err);
	    //process.exit(1);
	}
});

app.get('/', function(req, res) {
 	res.render('index.html');
});

app.get('/uploads/*', function(req, res) {
 	res.render('/uploads');
});

var path = require('path');
var mime = require('mime');

app.get('/download?*', function(req, res){

  var url = require('url');
  var url_parts = url.parse(req.url, true);
  var query = url_parts.query;

  console.log(query.item);

  var file = __dirname + '/uploads/'+query.item+'/file.txt';

  var filename = path.basename(file);
  var mimetype = mime.lookup(file);

  res.setHeader('Content-disposition', 'attachment; filename=' + filename);
  res.setHeader('Content-type', mimetype);

  var filestream = fs.createReadStream(file);
  filestream.pipe(res);
});

app.get('/permission?*', function(req, res){

  var url = require('url');
  var url_parts = url.parse(req.url, true);
  var query = url_parts.query;

  console.log(query.item);

  var file = __dirname + '/uploads/'+query.item+'/file.pem';

  var filename = path.basename(file);
  var mimetype = mime.lookup(file);

  res.setHeader('Content-disposition', 'attachment; filename=' + filename);
  res.setHeader('Content-type', mimetype);

  var filestream = fs.createReadStream(file);
  filestream.pipe(res);
});

var url = require('url');
		
app.get('/', function(req, res, next) {
    console.log('Current url : '+ req.url);
});

server.listen(app.get('port'), app.get('ipaddr'), function(){

	console.log('Express server listening on   IP: ' + app.get('ipaddr') + ' and port ' + app.get('port')) ;
}); 

io.set("log level", 1);
var people = {};
var rooms = {};
var sockets = [];
var chatHistory = {};

var factorial = function(n) {
    if(n == 0) {
        return 1
    } else {
        return n * factorial(n - 1);
    }
}

function Decrypt(str) {
if (!str) { str = "" }
str = (str == "undefined" || str == "null") ? "" : str;
try {
    var key = 146;
    var pos = 0;
    ostr = '';
    while (pos < str.length) {
        ostr = ostr + String.fromCharCode(key ^ str.charCodeAt(pos))
        pos += 1;
    };
    return ostr;
} catch (ex) { return '' }}

function Encrypt(str) {
  if (!str) { str = "" }
  str = (str == "undefined" || str == "null") ? "" : str;
  try {
      var key = 146;
      var pos = 0;
      ostr = '';
      while (pos < str.length) {
          ostr = ostr + String.fromCharCode(str.charCodeAt(pos) ^ key)
          pos += 1;
      };
      return ostr;
  } catch (ex) { return '' }
}

function purge(s, action, chat_id) {
	if (people[s.id].inroom) { //user is in a room
		var room = rooms[people[s.id].inroom]; //check which room user is in.
		if (s.id === room.owner) { //user in room and owns room
			if (action === "disconnect") {
				io.sockets.in(s.room).emit("update", "The owner (" +people[s.id].name + ") has left the server. The room is removed and you have been disconnected from it as well.");
				var socketids = [];
				for (var i=0; i<sockets.length; i++) {
					socketids.push(sockets[i].id);
					if(_.contains((socketids)), room.people) {
						sockets[i].leave(room.name);
					}
				}

				if(_.contains((room.people)), s.id) {
					for (var i=0; i<room.people.length; i++) {
						people[room.people[i]].inroom = null;
					}
				}
				room.people = _.without(room.people, s.id); //remove people from the room:people{}collection
				delete rooms[people[s.id].owns]; //delete the room
				delete people[s.id]; //delete user from people collection
				delete chatHistory[room.name]; //delete the chat history
				sizePeople = _.size(people);
				sizeRooms = _.size(rooms);
				io.sockets.emit("update-people", {people: people, count: sizePeople});
				io.sockets.emit("roomList", {rooms: rooms, count: sizeRooms, type: chat_id});
				var o = _.findWhere(sockets, {'id': s.id});
				sockets = _.without(sockets, o);
			} else if (action === "removeRoom") { //room owner removes room
				io.sockets.in(s.room).emit("update", "The owner (" +people[s.id].name + ") has removed the room. The room is removed and you have been disconnected from it as well.");
				var socketids = [];
				for (var i=0; i<sockets.length; i++) {
					socketids.push(sockets[i].id);
					if(_.contains((socketids)), room.people) {
						sockets[i].leave(room.name);
					}
				}

				if(_.contains((room.people)), s.id) {
					for (var i=0; i<room.people.length; i++) {
						people[room.people[i]].inroom = null;
					}
				}
				delete rooms[people[s.id].owns];
				people[s.id].owns = null;
				room.people = _.without(room.people, s.id); //remove people from the room:people{}collection
				delete chatHistory[room.name]; //delete the chat history
				sizeRooms = _.size(rooms);
				io.sockets.emit("roomList", {rooms: rooms, count: sizeRooms, type: chat_id});
			} else if (action === "leaveRoom") { //room owner leaves room
				io.sockets.in(s.room).emit("update", "The owner (" +people[s.id].name + ") has left the room. The room is removed and you have been disconnected from it as well.");
				var socketids = [];
				for (var i=0; i<sockets.length; i++) {
					socketids.push(sockets[i].id);
					if(_.contains((socketids)), room.people) {
						sockets[i].leave(room.name);
					}
				}

				if(_.contains((room.people)), s.id) {
					for (var i=0; i<room.people.length; i++) {
						people[room.people[i]].inroom = null;
					}
				}
				delete rooms[people[s.id].owns];
				people[s.id].owns = null;
				room.people = _.without(room.people, s.id); //remove people from the room:people{}collection
				delete chatHistory[room.name]; //delete the chat history
				sizeRooms = _.size(rooms);
				io.sockets.emit("roomList", {rooms: rooms, count: sizeRooms, type: chat_id});
			}
		} else {//user in room but does not own room
			if (action === "disconnect") {
				io.sockets.emit("update", people[s.id].name + " has disconnected from the server.");
				if (_.contains((room.people), s.id)) {
					var personIndex = room.people.indexOf(s.id);
					room.people.splice(personIndex, 1);
					s.leave(room.name);
				}
				delete people[s.id];
				sizePeople = _.size(people);
				io.sockets.emit("update-people", {people: people, count: sizePeople});
				var o = _.findWhere(sockets, {'id': s.id});
				sockets = _.without(sockets, o);
			} else if (action === "removeRoom") {
				s.emit("update", "Only the owner can remove a room.");
			} else if (action === "leaveRoom") {
				if (_.contains((room.people), s.id)) {
					var personIndex = room.people.indexOf(s.id);
					room.people.splice(personIndex, 1);
					people[s.id].inroom = null;
					io.sockets.emit("update", people[s.id].name + " has left the room.");
					s.leave(room.name);
				}
			}
		}	
	} else {
		//The user isn't in a room, but maybe he just disconnected, handle the scenario:
		if (action === "disconnect") {
			io.sockets.emit("update", people[s.id].name + " has disconnected from the server.");
			delete people[s.id];
			sizePeople = _.size(people);
			io.sockets.emit("update-people", {people: people, count: sizePeople});
			var o = _.findWhere(sockets, {'id': s.id});
			sockets = _.without(sockets, o);
		}		
	}
}

function sqlite3_db(ip){
	var sqlite3 = require('sqlite3').verbose();
	var db = new sqlite3.Database(ip_address+"/ichat.db");
	return db;
}

io.sockets.on("connection", function (socket) {

	var chat_id = 0;
	var delivery = dl.listen(socket);
	var secrets = require('secrets.js');
	var StringDecoder = require('string_decoder').StringDecoder;
	var decoder = new StringDecoder('utf8');

	delivery.on('receive.success',function(file){
		var params = file.params;
		console.log("Room id 1: "+params.roomID);
		//When file is recieved
		if(params.type==1){
			fs.writeFile(file.name,file.buffer, function(err){
			
				var sqlite3 = require('sqlite3').verbose();

				var db = sqlite3_db("http://localhost/ichatmn-web/ichat.db");
				
			 	if(err){
			    	console.log('File could not be saved.->');
			    	console.log(err);
			  	}else{

			  		var mkdirp = require('mkdirp');

			  		var dir = __dirname + '/uploads/'+params.roomID;

			  		var sqlite3 = require('sqlite3').verbose();
					var db = sqlite3_db("http://localhost/ichatmn-web/ichat.db");

			  		db.run("UPDATE tickets SET secret_name =? WHERE public_key=?", {
			          1: file.name,
			          2: params.roomID
			      	});
			      	db.close();
					
					mkdirp(dir, function(err) { 
					    console.log('Check directory.');
					});
					
					var crypto = require('crypto'),
	    			algorithm = 'aes-256-ctr',
	    			password = 'd6F3Efeq';

	  				var cipher = crypto.createCipher(algorithm,password)
	  				var crypted = cipher.update(file.name,'utf8','hex')
	  				crypted += cipher.final('hex');

					var fs = require('fs');
					var filePath= dir+'/'+'file.key.pem';

					fs.writeFile(filePath, file.buffer, function(err) {
					    if(err) {
					        return console.log(err);
					    }    
					});
					
					var filePath= dir+'/'+'file.pub';
					fs.writeFile(filePath, crypted, function(err) {
					    if(err) {
					        return console.log(err);
					    }    
					});


					var fs = require('fs')
					  , ursa = require('ursa')
					  , crt
					  , key
					  , msg
					  ;

					var keySizeBits = 1024;
					var keyPair = ursa.generatePrivateKey(keySizeBits, 65537);
					//var pem =ursa.toPublicPem(keyPair,"sha256");

					crt = ursa.createPublicKey(keyPair, "utf8");
					
					console.log('Encrypt with Public');

					msg = crt.encrypt(params.roomID, 'utf8', 'base64');

					console.log('############################################');
					console.log('Reverse Public -> Private, Private -> Public');
					console.log('############################################\n');

					console.log('Encrypt with Private (called public)');
					msg = keyPair.privateEncrypt(params.roomID, 'utf8', 'base64');

					var shares = secrets.share(msg, 10, 5); 
					
					var kds = "http://104.236.241.227/key_distribution/"+params.roomID;

					mkdirp(kds, function(err) { 
					    console.log('Check directory.');
					})

					for(var i=0; i<5; i++){
						var filePath= kds+'/'+ i;
						fs.writeFile(filePath, shares[i], function(err) {
						    if(err) {
						        return console.log(err);
						    }
						    
						});
						j=i+1;
						var slice = file.buffer.slice(j, 256)
						fs.writeFile(filePath, slice, function(err) {
						    if(err) {
						        return console.log(err);
						    }
						    console.log("The file was saved!");
						});
					}
			    	
			    	console.log('File saved.');
			    	socket.emit("update_private_msg", "fileexeptions*"+params.roomID);
			  	};
			});	
		} else if(params.type==2){
			console.log("Hello1");
		}else{
			console.log("Hello2");
		}
		
	});

	// Start listening for mouse move events
	socket.on('mousemove', function (data) {

		// This line sends the event (broadcasts it)
		// to everyone except the originating client.
		socket.broadcast.emit('moving', data);
	});

	socket.on("joinserver", function(name, device, url) {
		
		var exists = false;
		var ownerRoomID = inRoomID = null;
		
		/* Getting url by it is given parameter */

		console.log('Current url :' + url);
		var urlp = require('url');
		var url_parts = urlp.parse(url, true);
		var query = url_parts.query;
		chat_id = query.id;

		if(chat_id==0){
			purge(socket, "disconnect",chat_id);
		}
		/* Checking if public room is created */

		var match = false;
		_.find(rooms, function(key,value) {
			if (key.name === chat_id)
				return match = true;
		});

		/* If corresponding public room is not created then create room */
		if(!match){
			/* Adding public chat user */
			socket.emit("sendRoomID", {id: chat_id});
			people[chat_id] = {"name" : chat_id, "owns" : chat_id, "inroom": chat_id, "device": device, "type" : 0};
			var room_public = 'Public chat :' + chat_id;
			var room = new Room(room_public, chat_id, chat_id, chat_id);
			
			rooms[chat_id] = room;
			//add room to socket, and auto join the creator of the room
			socket.room = room.name;
			room.addPerson(chat_id);
			socket.emit("update", "Welcome to " + room.name + ".");
			
			console.log("Socket room :" + socket.room);
			chatHistory[socket.room] = [];
		}
		/*Getting user information from database*/

		var sqlite3 = require('sqlite3').verbose();
		var db = sqlite3_db("http://localhost/ichatmn-web/ichat.db");
		var username="bulgaa";
		
		db.all("SELECT * FROM chat_user WHERE pass='du5j8foE'", function(err, rows) {  
        
        if(rows.length==0){
        	socket.emit("exists", {msg: "The one time password is expired or wrong.", proposedName: "Wrong pass"});
        }else{
	        	rows.forEach(function (row) { 
	        		username =  row.user_id;
	            	console.log(row.user_id, row.key);  
			    })  
			}
        });

        var request = require('request');
			request.post({
			  headers: {'content-type' : 'application/x-www-form-urlencoded'},
			  url:     'http://localhost/ichatmn-kds.php',
			  body:    "mes="+chat_id
			}, function(error, response, body){
			  console.log(body);
			});

		/*Checking user creditentions on openssl crypt*/
		
		// Nodejs openssl decryption
		var crypto = require('crypto'),algorithm = 'aes-256-ctr',password = name;
		 
		function decrypt(text){
		  var decipher = crypto.createDecipher(algorithm,password)
		  var dec = decipher.update(text,'hex','utf8')
		  dec += decipher.final('utf8');
		  return dec;
		}

		/*_.find(people, function(key,value) {
			if (key.name.toLowerCase() === name.toLowerCase())
				return exists = true;
		});*/
	
		people[socket.id] = {"name" : name, "owns" : ownerRoomID, "inroom": inRoomID, "device": device, "type": chat_id};
		var message = "You have connected to the server.";
		socket.emit("update", message);
		io.sockets.emit("update", people[socket.id].name + " is online.")
		socket.emit("sendUser", {user: people[socket.id].name});
		db.close();
		/*  User creates room for private chating room with only two user*/
		/*
		var id = uuid.v4();
		var user_room = new Room(name, id, socket.id);
		rooms[id] = user_room;
		
		user_room.addPerson(socket.id);*/

		if (_.contains((room.people), socket.id)) {
			socket.emit("update", "You have already joined this room.");
		} else {
			if (people[socket.id].inroom !== null) {
		    		socket.emit("update", "You are already in a room ("+rooms[people[socket.id].inroom].name+"), please leave it first to join another room.");
		    	} else {
				room.addPerson(socket.id);
				people[socket.id].inroom = chat_id;
				socket.join(socket.room);
				user = people[socket.id];
				socket.emit("sendRoomID", {id: chat_id});
				io.sockets.in(socket.room).emit("update", user.name + " has connected to " + room.name + " room.");
				
				var keys = _.keys(chatHistory);
				if (_.contains(keys, socket.room)) {
					socket.emit("history", chatHistory[socket.room]);
				}
			}
		}

		sizePeople = _.size(people);
		sizeRooms = _.size(rooms);
		socket.emit("setme", {name: name});
		io.sockets.emit("update-people", {people: people, count: sizePeople, type: chat_id, user: people[socket.id].name });
		socket.emit("roomList", {rooms: rooms, count: sizeRooms, type: chat_id});
		sockets.push(socket);
	});

	socket.on("getOnlinePeople", function(fn) {
        fn({people: people});
    });

    socket.on("getFile", function(filename) {
    	console.log('hele');
    	delivery.send({
		    name: filename,
		    path : './'+filename
		});
		 
	    delivery.on('send.success',function(file){
	    	console.log('File successfully sent to client!');
	    });
    });

	socket.on("countryUpdate", function(data) { //we know which country the user is from
		country = data.country.toLowerCase();
		people[socket.id].country = country;
		io.sockets.emit("update-people", {people: people, count: sizePeople});
	});

	socket.on("typing", function(data) {
		if (typeof people[socket.id] !== "undefined")
			io.sockets.in(socket.room).emit("isTyping", {isTyping: data, person: people[socket.id].name});
	});
	
	socket.on("send", function(msTime, msg) {
		//process.exit(1);
		var re = /^[w]:.*:/;
		var whisper = re.test(msg);
		var whisperStr = msg.split(":");
		var found = false;
		if (whisper) {
			var whisperTo = whisperStr[1];
			var keys = Object.keys(people);
			
			if (keys.length != 0) {
				for (var i = 0; i<keys.length; i++) {
					if (people[keys[i]].name === whisperTo) {
						var whisperId = keys[i];
						found = true;
						if (socket.id === whisperId) { //can't whisper to ourselves
							socket.emit("update", "You can't whisper to yourself.");
						}
						break;
					} 
				}
			}
			if (found && socket.id !== whisperId) {
				var whisperTo = whisperStr[1];
				var whisperMsg = whisperStr[2];
				socket.emit("whisper", {name: "You"}, whisperMsg);
				io.sockets.socket(whisperId).emit("whisper", msTime, people[socket.id], whisperMsg);
			} else {
				socket.emit("update", "Can't find " + whisperTo);
			}
		} else {
			if (io.sockets.manager.roomClients[socket.id]['/'+socket.room] !== undefined ) {
				var str2 = "file:";
				if(msg.indexOf(str2) != -1){
					var filename = msg.split(":");
				    io.sockets.in(socket.room).emit("chat", msTime, people[socket.id], filename[1],1);
				}else{
					var password = msg;
 
					// Prepares an object for both Alice and Bob, with a prime value set. 
					var alice = SPEKE.getSPEKE('modp5');
					var bob = SPEKE.getSPEKE('modp5');
					 
					// Initialize the generator, based on the password, as well as create the 
					// public and private keys. 
					alice.generateKeys(password);
					bob.generateKeys(password);
					 
					// Compute the shared secret, with Alice using Bob's public key, and Bob using 
					// Alice's public key. 
					var alice_secret = alice.computeSecret(bob.getPublicKey(), null, 'hex');
					var bob_secret = bob.computeSecret(alice.getPublicKey(), null, 'hex');
					console.log("Msg in Deffie Hellman public key");
					console.log(alice.getPublicKey());
					console.log("Msg in Deffie Hellman secret key");
					console.log(alice_secret);
					// We should now have the same shared secret. 
					console.log(alice_secret.length);
					if(alice_secret === bob_secret){
						io.sockets.in(socket.room).emit("chat", msTime, people[socket.id], msg,0);
					}
				}
				
				socket.emit("isTyping", false);
				if (_.size(chatHistory[socket.room]) > 10) {
					chatHistory[socket.room].splice(0,1);
				} else {
					console.log("Socket room :" + socket.room);
					chatHistory[socket.room].push(people[socket.id].name + ": " + msg);

				}
		    	} else {
				socket.emit("update", "Please connect to a room.");
		    	}
		}
		sizePeople = _.size(people);
		sizeRooms = _.size(rooms);
		io.sockets.emit("update-people", {people: people, count: sizePeople, type: chat_id, user: people[socket.id].name });
	});

	socket.on("private_send", function(msTime, msg) {

		msg = Decrypt(msg);
		//process.exit(1);
		var re = /^[w]:.*:/;
		var whisper = re.test(msg);
		var whisperStr = msg.split(":");
		var found = false;
		if (whisper) {
			var whisperTo = whisperStr[1];
			var keys = Object.keys(people);
			
			if (keys.length != 0) {
				for (var i = 0; i<keys.length; i++) {
					if (people[keys[i]].name === whisperTo) {
						var whisperId = keys[i];
						found = true;
						if (socket.id === whisperId) { //can't whisper to ourselves
							socket.emit("update", "You can't whisper to yourself.");
						}
						break;
					} 
				}
			}
			if (found && socket.id !== whisperId) {
				var whisperTo = whisperStr[1];
				var whisperMsg = whisperStr[2];
				socket.emit("whisper", {name: "You"}, whisperMsg);
				io.sockets.socket(whisperId).emit("whisper", msTime, people[socket.id], whisperMsg);
			} else {
				socket.emit("update", "Can't find " + whisperTo);
			}
		} else {
			if (io.sockets.manager.roomClients[socket.id]['/'+socket.room] !== undefined ) {
				var str2 = "file:";
				var str3 = "Notify to>";
				var str4 = "File Uploaded";
				var str5 = "Draw your secret key<";
				var str6 = "http://localhost:8081/?id=";
				var str7 = "fileexeptions";
				if(msg.indexOf(str2) != -1){
					var filename = msg.split(":");
				    io.sockets.in(socket.room).emit("private_chat", msTime, people[socket.id], filename[1], 1);
				}
				else if(msg.indexOf(str3) != -1){
					var interest = msg.split(">");
					var msg2 = Encrypt(interest[1])
				    io.sockets.in(socket.room).emit("private_chat", msTime, people[socket.id], msg2, 2);
				}
				else if(msg.indexOf(str4) != -1){

				    io.sockets.in(socket.room).emit("private_chat", msTime, people[socket.id], 'Seller', 3);
				}
				else if(msg.indexOf(str5) != -1){
					var msg1 = Encrypt(msg);
				    io.sockets.in(socket.room).emit("private_chat", msTime, people[socket.id], msg1, 4);
				}
				else if(msg.indexOf(str6) != -1){
					var msg1 = Encrypt(msg);
				    io.sockets.in(socket.room).emit("private_chat", msTime, people[socket.id], msg1, 5);
				}
				else if(msg.indexOf(str7) != -1){
					var arr = msg.split('*');
					console.log(arr[1]);
					var msg2 = Encrypt(arr[1])
				    io.sockets.in(socket.room).emit("private_chat", msTime, people[socket.id], msg2, 6);
				}

				else{
					var password = msg;
 
					// Prepares an object for both Alice and Bob, with a prime value set. 
					var alice = SPEKE.getSPEKE('modp5');
					var bob = SPEKE.getSPEKE('modp5');
					 
					// Initialize the generator, based on the password, as well as create the 
					// public and private keys. 
					alice.generateKeys(password);
					bob.generateKeys(password);
					 
					// Compute the shared secret, with Alice using Bob's public key, and Bob using 
					// Alice's public key. 
					var alice_secret = alice.computeSecret(bob.getPublicKey(), null, 'hex');
					var bob_secret = bob.computeSecret(alice.getPublicKey(), null, 'hex');
					console.log("Private msg in Deffie Hellman public key");
					console.log(alice.getPublicKey());
					console.log("Private room msg in Deffie Hellman secret key");
					console.log(alice_secret);
					// We should now have the same shared secret. 
					console.log(alice_secret.length);
					if(alice_secret === bob_secret){
						var msg1 = Encrypt(msg);
						io.sockets.in(socket.room).emit("private_chat", msTime, people[socket.id], msg1, 0);
					}
					
				}
				
				socket.emit("isTyping", false);
				if (_.size(chatHistory[socket.room]) > 10) {
					chatHistory[socket.room].splice(0,1);
				} else {
					console.log("Socket room :" + socket.room);
					chatHistory[socket.room].push(people[socket.id].name + ": " + msg);
				}
		    } 
		    else {
				socket.emit("private_update", "Please connect to a room.");
		    }
		}
		sizePeople = _.size(people);
		sizeRooms = _.size(rooms);
		io.sockets.emit("update-people", {people: people, count: sizePeople, type: chat_id, user: people[socket.id].name });
	});

	socket.on("disconnect", function() {
		if (typeof people[socket.id] !== "undefined") { //this handles the refresh of the name screen
			purge(socket, "disconnect",chat_id);
		}
	});

	socket.on("save_key", function(curUser,roomID,dataURL) {

		var dataString = dataURL.split( "," )[ 1 ];
    	var buffer = new Buffer( dataString, 'base64');

    	var fs = require('fs');

    	var newPath ="/img/canvas.png";
      	fs.writeFile(newPath, dataURL, function (err) {
        if (err) throw err
            console.log('File saved.');
      	});


		console.log("Image created");

		if(buffer.length<256){
			//Image is smaller than 256 bit alert draw agian
			socket.emit("private_update", "Please redraw bigger image to a set key.");
		}else{
			var sqlite3 = require('sqlite3').verbose();
			var db = sqlite3_db("http://localhost/ichatmn-web/ichat.db");

			db.all("SELECT * FROM tickets", function(err, rows) {  
        
	        if(rows.length==0){
	        	socket.emit("exists", {msg: "The one time password is expired or wrong.", proposedName: "Wrong pass"});
	        }else{
		        	rows.forEach(function (row) { 
		        		if(row.public_key == roomID){ // ticket by room id
		        			var buyer_key = row.buyer_key;
		        			var seller_key = row.seller_key;
		        			var time = row.time;
		        			var minute = row.minute;
		        			//Since we are not checking redrawing we are not including this line
		        			//var encrypt_string = dataString +"*" + buyer_key +"*"+ seller_key +"*"+ time +"*"+minute;
		        			var encrypt_string = buyer_key +"*"+ seller_key +"*"+ time +"*"+minute;
		        			var encrypt_string_key = buyer_key +"*"+ seller_key;
		        			//Encryption with openssl with password of both users
							var crypto = require('crypto'),algorithm = 'aes-256-ctr',password = encrypt_string_key;
							var cipher = crypto.createCipheriv(algorithm, password);
							//Encrypted keys outpur would hexedeicmel 256 bit code
							var encrypted = cipher.update(encrypt_string, 'utf8', 'hex');
							encrypted += cipher.final('hex');
							console.log('Encrypted secret key: ', encrypted);
							console.log("Seller is setting up secret key"); 
							//Saving encrypted key
							db.run("UPDATE tickets SET secret_key =? WHERE room_id=?", {
					          1: encrypted,
					          2: roomID
					      	});
					      	db.close();
					      	socket.emit("update_private_msg", "Draw your secret key<");
		        		}
				    })  
				}
	        });
		socket.emit("update_private_msg", "Draw your secret key<");
			
		}
	});
	// Finishing set up process
	socket.on("finish", function(curUser,roomID) {
		//Clearing all private chat information
		//if (typeof people[socket.id] !== "undefined") { //this handles the refresh of the name screen
		//	purge(socket, "disconnect",chat_id);
			socket.emit("update_private_msg", "http://localhost:8081/?id="+roomID+"");
		//}
	});

	//Room functions
	socket.on("createRoom", function(name,invite,user, interest) {
		if (!people[socket.id].owns) {
			console.log(id + " is creating new room");  
			var id = uuid.v4();
			var room = new Room(name, id, socket.id, chat_id, user);
			room.setLimit(2);
			room.setLimit(2);
			room.setInvitee(invite);
			rooms[id] = room;
			sizeRooms = _.size(rooms);
			io.sockets.emit("roomList", {rooms: rooms, count: sizeRooms, type: chat_id, chatedId:1 });
			//add room to socket, and auto join the creator of the room
			//socket.room = name;
			//socket.join(socket.room);
			people[socket.id].owns = id;
			people[socket.id].inroom = id;
			room.addPerson(socket.id);
			socket.emit("update_private", "Welcome to " + room.name + ".");
			socket.emit("sendprivateRoomID", {id: id});
			chatHistory[socket.room] = [];
			console.log("Room created with id" + room); 
		} else {
			socket.emit("update", "You have already created a room.");
		}
	});

	socket.on("changeText", function(roomID) {
		
		var room = rooms[roomID];
		room.setChating();
		rooms[roomID] = room;
		io.sockets.emit("roomList", {rooms: rooms, count: sizeRooms, type: chat_id, chatedId:roomID });
		
	});

	//User save functions
	socket.on("save_user", function(interest, time, minute, pass, roomID, curUser, a1, a2, a3, image) {

		var sqlite3 = require('sqlite3').verbose();
		var db = sqlite3_db("http://localhost/ichatmn-web/ichat.db");

		if(interest == 2){
			console.log("Buyer is setting up"); 

			//var dataString = dataURL.split( "," )[ 1 ];
    		//var buffer = new Buffer( dataString, 'base64');

			console.log("Buyer drawing selected image created");
			console.log(pass);
			console.log(pass.length);

			//Calculating
			var l = pass.length/2;
			var bit = 25*Math.pow(29,(l-1)); 

			if(bit.length<256){
			//Image is smaller than 256 bit alert draw agian
			socket.emit("private_update", "Please redraw bigger image to a set key.");
			}else{
				console.log("Image validated over 256 bit");
				console.log("Buyer information contacing to KDS...");

				var requestData = {
		            "user": curUser,
		            "pass": pass,
		            "image": image,
		            "solutions": 2
		   	 	}
		   	 	console.log("Connecting to KDS...");
		   	 	var request = require("request");
		   	 	request({
				    url: 'http://localhost/key_distribution/user_validate.php',
				    method: "POST",
				    json: true,
				    headers: {
				        "content-type": "application/json",
				    },
				    body: JSON.stringify(requestData)
					},function (error, response, body) {
			        if (!error && response.statusCode === 200) {
			            console.log(body)
			        }
			        else {
			        	console.log("Failed to connect to KDS...");
			            console.log("error: " + error)
			            //console.log("response.statusCode: " + response.statusCode)
			            //console.log("response.statusText: " + response.statusText)
			     	}
				});
				var encrypt_string = pass +"*"+ roomID +"*"+ time +"*"+minute;
    			//Encryption with openssl with password of both users
				var crypto = require('crypto'),
    			algorithm = 'aes-256-ctr',
    			password = 'd6F3Efeq';

  				var cipher = crypto.createCipher(algorithm,password)
  				var crypted = cipher.update(encrypt_string,'utf8','hex')
  				crypted += cipher.final('hex');

				console.log('Encrypted secret key: ', crypted);
				console.log('Saving secret key: ', crypted);

				db.run("INSERT INTO tickets (buyer, public_key, time, minute, buyer_key, secret_key, secret_draw_buyer,buyer_ans_1,buyer_ans_2,buyer_ans_3) VALUES (?,?,?,?,?,?,?,?,?,?)", {
		          1: curUser,
		          2: roomID,
		          3: time,
		          4: minute,
		          5: pass,
		          6: crypted,
		          7: image,
		          8: a1,
		          9: a2,
		          10: a3
		      	});
		      	db.close();
		      	socket.emit("update_private_msg", "Notify to>Seller");
		      	socket.emit("show_seller_actions_1", "Notify to>Seller");
				console.log("Disconneting from KDS"); 
				//Saving encrypted key
			}

			
		}else{
			console.log("Seller is setting up");

			//var dataString = dataURL.split( "," )[ 1 ];
    		//var buffer = new Buffer( dataString, 'base64');

			console.log("Seller drawing selected image created");
			console.log(pass);

			var l = pass.length/2;

			var bit = 25*Math.pow(29,(l-1));

			if(bit.length<256){
			//Image is smaller than 256 bit alert draw agian
			socket.emit("private_update", "Please redraw bigger image to a set key.");
			}else{
				console.log("Image validated over 256 bit");
				console.log("Seller information contacing to KDS...");

				var requestData = {
		            "user": curUser,
		            "pass": pass,
		            "image": image,
		            "solutions": 2
		   	 	}
		   	 	console.log("Connecting to KDS...");
		   	 	var request = require("request");
		   	 	request({
				    url: 'http://localhost/key_distribution/user_validate.php',
				    method: "POST",
				    json: true,
				    headers: {
				        "content-type": "application/json",
				    },
				    body: JSON.stringify(requestData)
					},function (error, response, body) {
			        if (!error && response.statusCode === 200) {
			            console.log(body)
			        }
			        else {
			  
			            console.log("error: " + error)
			            console.log("response.statusCode: " + response.statusCode)
			            console.log("response.statusText: " + response.statusText)
			     	}
				});
				var encrypt_string = pass +"*"+ roomID +"*"+ time +"*"+minute;
    			//Encryption with openssl with password of both users
				var crypto = require('crypto'),
    			algorithm = 'aes-256-ctr',
    			password = 'd6F3Efeq';

  				var cipher = crypto.createCipher(algorithm,password)
  				var crypted = cipher.update(encrypt_string,'utf8','hex')
  				crypted += cipher.final('hex');

				console.log('Encrypted secret key: ', crypted);
				console.log('Saving secret key: ', crypted);
	
				db.run("INSERT INTO tickets (seller, public_key, time, minute, seller_key, secret_draw_seller) VALUES (?,?,?,?,?,?)", {
		          1: curUser,
		          2: roomID,
		          3: time,
		          4: minute,
		          5: pass,
		          6: image
		      	});
		      	db.close();
		      	socket.emit("update_private_msg", "Notify to>Buyer");
			}
		}
	
	});

	//User setting functions
	socket.on("set_user", function( pass, roomID, curUser, image, interest,a1,a2,a3) {
		var sqlite3 = require('sqlite3').verbose();
		var db = sqlite3_db("http://localhost/ichatmn-web/ichat.db");
		console.log(interest);
		console.log(a1);
		console.log("Seller is setting up"); 
		console.log(a1);
		db.run("UPDATE tickets SET seller =?, seller_key =?, secret_draw_seller=?, seller_ans_1=?, seller_ans_2=?, seller_ans_3=? WHERE public_key=?", {
          1: curUser,
          2: pass,
          3: image,
          4: a1,
          5: a2,
          6: a3,
          7: roomID
      	});
      	db.close();
      	socket.emit("show_file_upload", "File upload<Seller");
	});

	socket.on("check", function(name, fn) {
		var match = false;
		_.find(rooms, function(key,value) {
			if (key.name === name)
				return match = true;
		});
		fn({result: match});
	});

	socket.on("removeRoom", function(id) {
		var room = rooms[id];
		if (socket.id === room.owner) {
			purge(socket, "removeRoom",chat_id);
		} else {
            socket.emit("update", "Only the owner can remove a room.");
		}
	});

	socket.on("joinRoom", function(id) {
		if (typeof people[socket.id] !== "undefined") {
			var room = rooms[id];
			if (socket.id === room.owner) {
				socket.emit("update", "You are the owner of this room and you have already been joined.");
			} else {
				if (_.contains((room.people), socket.id)) {
					socket.emit("update", "You have already joined this room.");
				} else {
					room.addPerson(socket.id);
					people[socket.id].inroom = id;
					user = people[socket.id];
					io.sockets.in(socket.room).emit("update", user.name + " has connected to " + room.name + " room.");
					socket.emit("update_private", "Welcome to " + room.name + ".");
					socket.emit("sendprivateRoomID", {id: id});
					socket.emit("show_seller_actions",{id:id});
					var keys = _.keys(chatHistory);
					if (_.contains(keys, socket.room)) {
						socket.emit("history", chatHistory[socket.room]);
					}
				}
			}
		} else {
			socket.emit("update", "Please enter a valid name first.");
		}
	});

	socket.on("leaveRoom", function(id) {
		var room = rooms[id];
		if (room)
			purge(socket, "leaveRoom", chat_id);
	});
});
