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

//Configuration parts
var t = require('console-stamp')(console, '[HH:MM:ss.ms]');
var multer  = require('multer');
var done=false;
var ip_address = '/opt/lampp/htdocs/ichatmn-web';
var internal = '192.168.10.110';
var ip_run = "192.168.10.110"; //127.0.0.1
var external_hosts = ['127.0.0.1', '192.168.10.124'];//,'192.168.10.101'];
var num_hosts = 2;
var kds_server = "192.168.10.110"
var global_room=null;


app.configure(function() {
	app.set('port', process.env.OPENSHIFT_NODEJS_PORT || 8080);
  	app.set('ipaddr', process.env.OPENSHIFT_NODEJS_IP || "192.168.10.110");
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

  var file = __dirname + 'http:/104.236.241.227/key_distribution/'+query.item+'/file.pub';

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

  var file = __dirname + '/uploads/'+query.item+'/file.key.pem';

  var filename = path.basename(file);
  var mimetype = mime.lookup(file);

  res.setHeader('Content-disposition', 'attachment; filename=' + filename);
  res.setHeader('Content-type', mimetype);

  var filestream = fs.createReadStream(file);
  filestream.pipe(res);
});

app.get('/file?*', function(req, res){

  var url = require('url');
  var url_parts = url.parse(req.url, true);
  var query = url_parts.query;

  console.log(query.item);

  var crypto = require('crypto'),
	    		algorithm = 'aes-256-ctr',
	    		password = 'd6F3Efeq';

  var decipher = crypto.createDecipher(algorithm,password)
  var dec = decipher.update(query.item,'hex','utf8');
  dec += decipher.final('utf8');
  console.log(dec);

  var file = __dirname + '/'+dec;

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
	} catch (ex) { return '' }
}

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

function decode(number) {
    var string = "";
    number = number.slice(2);
    var length = number.length;
    for (var i = 0; i < length;) {
        var code = number.slice(i, i += 2);
        string += String.fromCharCode(parseInt(code, 16));
    }
    return string;
}

function encrypt(clearText, keySizeBytes, keyPair){
    var buffer = new Buffer(clearText);
    var maxBufferSize = keySizeBytes - 42; //according to ursa documentation
    var bytesDecrypted = 0;
    var encryptedBuffersList = [];

    //loops through all data buffer encrypting piece by piece
    while(bytesDecrypted < buffer.length){
        //calculates next maximun length for temporary buffer and creates it
        var amountToCopy = Math.min(maxBufferSize, buffer.length - bytesDecrypted);
        var tempBuffer = new Buffer(amountToCopy);

        //copies next chunk of data to the temporary buffer
        buffer.copy(tempBuffer, 0, bytesDecrypted, bytesDecrypted + amountToCopy);

        //encrypts and stores current chunk
        var encryptedBuffer = keyPair.encrypt(tempBuffer);
        encryptedBuffersList.push(encryptedBuffer);

        bytesDecrypted += amountToCopy;
    }

    //concatenates all encrypted buffers and returns the corresponding String
    return Buffer.concat(encryptedBuffersList).toString('base64');
}

function decrypt(encryptedString, keySizeBytes,keyPair){

    var encryptedBuffer = new Buffer(encryptedString, 'base64');
    var decryptedBuffers = [];
    var ursa = require("ursa");
    //if the clear text was encrypted with a key of size N, the encrypted 
    //result is a string formed by the concatenation of strings of N bytes long, 
    //so we can find out how many substrings there are by diving the final result
    //size per N
    var totalBuffers = encryptedBuffer.length / keySizeBytes;

    //decrypts each buffer and stores result buffer in an array
    for(var i = 0 ; i < totalBuffers; i++){
        //copies next buffer chunk to be decrypted in a temp buffer
        var tempBuffer = new Buffer(keySizeBytes);
        encryptedBuffer.copy(tempBuffer, 0, i*keySizeBytes, (i+1)*keySizeBytes);
        //decrypts and stores current chunk
        var decryptedBuffer = keyPair.decrypt(tempBuffer,'base64','base64',ursa.RSA_NO_PADDING);
        decryptedBuffers.push(decryptedBuffer);
    }

    //concatenates all decrypted buffers and returns the corresponding String
    return Buffer.concat(decryptedBuffers).toString();
}

function purge(s, action, chat_id) {

	if ( typeof people[s.id].inroom != 'undefined') { //user is in a room
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
				console.log("Socket ID:" + s.id);

				var sqlite3 = require('sqlite3').verbose();
				var db = sqlite3_db("http://192.168.10.110/ichatmn-web/ichat.db");

				db.all("SELECT * FROM zarlal", function(err, rows) {  
			        if(rows.length==0){
			        	socket.emit("exists", {msg: "No such room", proposedName: "Please try again later"});
			        }else{
			        	rows.forEach(function (row) { 
			        		if(row.id == chat_id){ // ticket by room id


			        			var chatter = row.chatter;
			        			chatter = chatter - 1;
			        			db.run("UPDATE zarlal SET chatter = ? WHERE id=?", {
									1: chatter,
									2: chat_id
								});
			        		}
					    }); 
					}
			    });

				if(people[s.id].type = 'seller' ){
					var chat_id = people[s.id].chat;
					db.run("UPDATE zarlal SET logged = ? WHERE id=?", {
			          1: 0,
			          2: chat_id
			      	});
				}

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
			}else if (action === "removeRoom") {
				s.emit("update", "Only the owner can remove a room.");
			}else if (action === "stop") {
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
			}else if (action === "leaveRoom") {
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
	var selleron = 0;
	var delivery = dl.listen(socket);
	var secrets = require('secrets.js');
	var StringDecoder = require('string_decoder').StringDecoder;
	var decoder = new StringDecoder('utf8');

	delivery.on('receive.success',function(file){

		//console.log(JSON.stringify(file));
		
		var params = file.params;
		var passKey = params.passKey;
		var fileName = file.name;
		var roomID = params.roomID;

		console.log("Crypto ID: "+params.roomID);
		console.log("File Key: "+params.passKey);
		
		var fs = require('fs');
		
		if(params.type==1){

			fs.writeFile(fileName, file.buffer, function(err){
		
				var sqlite3 = require('sqlite3').verbose();
				var db = sqlite3_db("http://192.168.10.110/ichatmn-web/ichat.db");
				
			 	if(err){
			    	console.log('File could not be saved.->');
			    	console.log(err);
			  	}else{

			  		var mkdirp = require('mkdirp');

			  		var dir = '/opt/lampp/htdocs/ichatmn-web/upload/'+params.roomID;

			  		mkdirp(dir, function (err) {
					    if (err) console.error(err)
					    else console.log('successfully started encryption with AES-256!')
					});

			  		var sqlite3 = require('sqlite3').verbose();
					var db = sqlite3_db("http://192.168.10.110/ichatmn-web/ichat.db");

			  		db.run("UPDATE tickets SET secret_name = ?, file_key = ? WHERE public_key=?", {
			          1: fileName,
			          2: passKey,
			          3: roomID
			      	});
					
					console.time("FileEncryption");
					console.log("File encryption started");
					
					var crypto = require('crypto');
					
					algorithm = 'aes-256-ctr',
	    			password = passKey;

					var cipher = crypto.createCipher(algorithm,password);
  					var crypted = Buffer.concat([cipher.update(file.buffer),cipher.final()]);
			    	
					var filePath= dir+'/'+'file.pub';

					fs.writeFile(filePath, crypted, function(err) {
					    if(err) {
					        return console.log(err);
					    }    
					});
					console.log('File encrypted.');
					console.timeEnd("FileEncryption");
			    	
			    	socket.emit("update_seller", params.roomID);
			    	
			  	};
			});	
		} 
		else if(params.type==2){

			var ip1 = params.ip1;
			var ip2 = params.ip2;
			var ip3 = params.ip3;

			if(external_hosts.indexOf(ip1)==-1){
				io.sockets.emit("update", "Check your secret IP");
				return;
			}
			if(external_hosts.indexOf(ip2)==-1){
				io.sockets.emit("update", "Check your secret IP");
				return;
			}
			 
			var StringDecoder = require('string_decoder').StringDecoder;

			var crypto = require('crypto'),
	    			algorithm = 'aes-256-ctr',
	    			password = 'd6F3Efeq';

			var shares1 = [];
			var fs = require('fs');
			//if(params.roomID==dec){

				//combine keys
				for(var i=0; i<3; i++){
					var filePath1= __dirname + '/http:/'+external_hosts[i]+'/'+params.roomID+'/'+i+'.txt';
					var item = fs.readFileSync(filePath1).toString();
					shares1.push(item);
				}

				var comb = secrets.combine( shares1 );
				var arr = comb.split('694c6f76654d6f6e676f6c6961');

				var decipher = crypto.createDecipher(algorithm,password)
				var dec = decipher.update(arr[0],'hex','utf8')
				dec += decipher.final('utf8');
				console.log(dec);

				if(dec=="" || dec==null){
					socket.emit("update", "Error on files");
					return;
				}
				if(dec == params.roomID ){
					console.log("Keys watched");
					console.log(comb);
					socket.emit("update_msg", "downloads*"+arr[1]);
				}else{
					console.log("no");
					socket.emit("update", "Secret keys not matched");
				}

		}else{
			console.log("Hello 3");
		}
	});
	// Start listening for mouse move events
	socket.on('mousemove', function (data) {

		// This line sends the event (broadcasts it)
		// to everyone except the originating client.
		socket.broadcast.emit('moving', data);
	});

	socket.on("joinserver", function(name, device, url) {
		
		var exists = 0;
		var ownerRoomID = inRoomID = null;
		
		/* Getting url by it is given parameter */

		var urlp = require('url');
		var url_parts = urlp.parse(url, true);
		var query = url_parts.query;

		var item =query.item;
		chat_id = query.id;

		console.log("Chat generated ID: "+item);

		console.time("Decoding Chat ID");
		console.log("Decoding ID for chat user type");
		var str = decode(item);
		var arr = str.split("***");
		console.timeEnd("Decoding Chat ID");

		console.log("User type: "+arr[1]);

		var type_real = arr[1];

		if(arr[0]==chat_id){
			console.log("Checking ID and user type");
		}else{
			console.log("Error 0101");
			socket.emit("exists", {msg: "Char room id wrong.", proposedName: "Wrong pass"});
			purge(socket, "disconnect",chat_id);
		}

		if(chat_id==0){
			purge(socket, "disconnect",chat_id);
			return;
		}

		/*Checking if two user is already loged in*/

		var sqlite3 = require('sqlite3').verbose();
		var db = sqlite3_db("http://192.168.10.110/ichatmn-web/ichat.db");

		db.all("SELECT * FROM zarlal", function(err, rows) {  
	        if(rows.length==0){
	        	socket.emit("exists", {msg: "No such roomd", proposedName: "Please try again later"});
	        }else{
	        	rows.forEach(function (row) { 
	        		if(row.id == chat_id){ // ticket by room id
	        			var chatter = row.chatter;
	        			if(row.chatter == 2){
	        				socket.emit("exists", {msg: "Two users already logged in.", proposedName: "Please try again later"});
	        				console.log("Exiting");
	        				purge(socket, "stop",chat_id);
	        			}else{
	        				chatter = chatter +1;
	        				if (type_real == 'seller'){
	        					db.run("UPDATE zarlal SET chatter = ?, logged =? WHERE id=?", {
						          1: chatter,
						          2: 1,
						          3: chat_id
						      	});
	        				}else{
	        					db.run("UPDATE zarlal SET chatter = ? WHERE id=?", {
						          1: chatter,
						          2: chat_id
						      	});
	        				}
	        			}
	        		}
			    }); 
			}
	    });
	
		if(exists==1){
			console.log("Exiting");
			return;
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
			var room_public = 'Private chat :' + chat_id;
			var room = new Room(room_public, chat_id, chat_id, chat_id);
			
			rooms[chat_id] = room;
			//add room to socket, and auto join the creator of the room
			socket.room = room.name;
			room.addPerson(chat_id);
			socket.emit("update", "Welcome to " + room.name + ".");
			
			console.log("Socket room :" + socket.room);
			chatHistory[socket.room] = [];
		}

		people[socket.id] = {"name" : name, "owns" : ownerRoomID, "inroom": inRoomID, "device": device, "type": type_real, "chat":chat_id};
		
		var message = "You have connected to the server.";
		
		socket.emit("update", message);

		io.sockets.emit("update", people[socket.id].name + " is online.");
		socket.emit("sendUser", {user: people[socket.id].name, type : type_real });
		
		/*  User creates room for private chating room with only two user*/

		if (_.contains((room.people), socket.id)) {
			socket.emit("update", "You have already joined this room.");
		} 
		else {
			if (people[socket.id].inroom !== null) {
		    	socket.emit("update", "You are already in a room ("+rooms[people[socket.id].inroom].name+"), please leave it first to join another room.");
		    } 
	    	else {
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

	socket.on("getOnlinePeople", function(fn) { fn({people: people});});

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
				var str8 = "downloads*";
				var str7 = "fileexeptions*";
				var str3 = "http://192.168.10.110:8081";
				if(msg.indexOf(str2) != -1){
					var filename = msg.split(":");
				    io.sockets.in(socket.room).emit("chat", msTime, people[socket.id], filename[1],1);
				}else if(msg.indexOf(str7) != -1){
					var arr = msg.split('*');
					console.log(arr[1]);
				    io.sockets.in(socket.room).emit("chat", msTime, people[socket.id], arr[1], 6);
				}
				else if(msg.indexOf(str8) != -1){
					var arr = msg.split('*');
					console.log(arr[1]);
				    io.sockets.in(socket.room).emit("chat", msTime, people[socket.id], arr[1], 7);
				}
				else if(msg.indexOf(str3) != -1){
				    io.sockets.in(socket.room).emit("chat", msTime, people[socket.id], msg, 3);
				}
				else{

					var password = msg;
 
					// Prepares an object for both Alice and Bob, with a prime value set. 
					//var alice = SPEKE.getSPEKE('modp5');
					//var bob = SPEKE.getSPEKE('modp5');
					 
					// Initialize the generator, based on the password, as well as create the 
					// public and private keys. 
					//alice.generateKeys(password);
					//bob.generateKeys(password);
					 
					// Compute the shared secret, with Alice using Bob's public key, and Bob using 
					// Alice's public key. 
					/*var alice_secret = alice.computeSecret(bob.getPublicKey(), null, 'hex');
					var bob_secret = bob.computeSecret(alice.getPublicKey(), null, 'hex');
					console.log("Msg in Deffie Hellman public key");
					console.log(alice.getPublicKey());
					console.log("Msg in Deffie Hellman secret key");
					console.log(alice_secret);
					// We should now have the same shared secret. 
					console.log(alice_secret.length);
					if(alice_secret === bob_secret){*/
					io.sockets.in(socket.room).emit("chat", msTime, people[socket.id], msg,0);
					//}
				}
	    	} 
	    	else {
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
				var str6 = "http://192.168.10.110:8081/?id=";
				var str7 = "fileexeptions*";
				var str8 = "downloads*";
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
				else if(msg.indexOf(str8) != -1){
					var arr = msg.split('*');
					console.log(arr[1]);
					var msg2 = Encrypt(arr[1])
				    io.sockets.in(socket.room).emit("private_chat", msTime, people[socket.id], msg2, 7);
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

		console.log("Socket ID:" + socket.id);

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
			var db = sqlite3_db("http://192.168.10.110/ichatmn-web/ichat.db");

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
					      	socket.emit("update_private_msg", "Draw your secret key<");
		        		}
				    })  
				}
	        });
		socket.emit("update_private_msg", "Draw your secret key<");
			
		}
	});

	socket.on("distribute", function(roomID) {

		console.log("Connecting KDS");
		console.time("KDS connection");

		var crypto = require('crypto'),
		algorithm = 'aes-256-ctr',
		password = 'd6F3Efeq';

		var cipher = crypto.createCipher(algorithm,password);
		var symmetric_key = cipher.update(roomID,'utf8','hex');
		symmetric_key += cipher.final('hex');

		secrets.init(20);
		var cipher = crypto.createCipher(algorithm,password);
		var crypted = cipher.update(roomID,'utf8','hex');
		crypted += cipher.final('hex')

		crypted_final = symmetric_key+"694c6f76654d6f6e676f6c6961"+crypted;

		console.log(crypted_final);
		
		console.time("SHAMIR SPLIT TIME");

		var title= "SHAMIR SPLIT TIME", t = process.hrtime();

		var t1 = process.hrtime(t);
		
		var shares = secrets.share(crypted_final, 5, 2); 
		console.timeEnd("SHAMIR SPLIT TIME");

		console.log("%s %d seconds and %d nanoseconds", title, t1[0], t1[1])

		var request = require('request');
		var randomstring = require("randomstring");

		var sqlite3 = require('sqlite3').verbose();
		var db = sqlite3_db("http://192.168.10.110/ichatmn-web/ichat.db");

		var mack = [];

		for(var i=0; i<num_hosts; i++){

			// Set the headers
			console.time("Host distribute : "+external_hosts[i]);
			var title= "Host saved : ", t = process.hrtime();
			var t1 = process.hrtime(t);

			var filePath= 'http://'+ external_hosts[i]+':8889';

			var headers = {
			    'User-Agent': roomID,
			    'Content-Type': 'application/x-www-form-urlencoded'
			}

			// Configure the request
			var options = {
			    url: filePath,
			    method: 'POST',
			    headers: headers
			}

			// Start the request
			request(options, function (error, response, body) {});

			var headers = {
			    'User-Agent': 'Super Agent/0.0.1',
			    'Content-Type': 'application/x-www-form-urlencoded'
			}
			var secret_feed = randomstring.generate(7);
			var url = 'http://'+ external_hosts[i] + '/storage/host.php';

			var extra = randomstring.generate(8);
			var newShare = shares[i]+""+extra;

			// Configure the request
			var options = {
			    url: url,
			    method: 'POST',
			    headers: headers,
			    form: {'secret': 'shamir', 'part': newShare, "id":secret_feed}
			}

			var day = {
				ip: external_hosts[i],
				secret: secret_feed
			};

			mack.push(day);
			// Start the request
			request(options, function (error, response, body) {
			    if (!error && response.statusCode == 200) {
			        // Print out the response body
			        console.log(body)
			    }
			});
			console.timeEnd("Host distribute : "+external_hosts[i]);
			console.log("%s %d seconds and %d nanoseconds", title, t1[0], t1[1]);
		}

		db.run("UPDATE tickets SET ip1 =? WHERE public_key=?", {
			1: JSON.stringify(mack),
			2: roomID
		});
		console.timeEnd("KDS connection");
		socket.emit("seller_feed", JSON.stringify(mack));
	});

	socket.on("finish", function(curUser,roomID) {
		console.log(roomID);
		socket.emit("update_msg", "http://192.168.10.110:8081/?id="+roomID+"");
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
		var db = sqlite3_db("http://192.168.10.110/ichatmn-web/ichat.db");

		console.log("Buyer is setting up"); 
		console.log("Buyer drawing selected image created");
		
		console.log("Buyer pass :"+pass);
		console.log("Pass draw size"+pass.length+"bits");

		//Calculating
		var l = pass.length/2;
		var bit = 25*Math.pow(29,(l-1)); 

		if(bit.length<256){
		//Image is smaller than 256 bit alert draw agian
		socket.emit("private_update", "Please redraw bigger image to a set key.");
		}else{

			console.log("Image validated over 256 bit");
			console.log("Buyer information contacing to KDS...");
	   	 	console.log("Connecting to KDS...");

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

			console.log("Disconneting from KDS"); 

			db.run("INSERT INTO tickets (buyer, public_key, time, minute, buyer_key, secret_key, secret_draw_buyer,buyer_ans_1,buyer_ans_2,buyer_ans_3, seller_attempt, buyer_attempt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", {
	          1: curUser,
	          2: roomID,
	          3: time,
	          4: minute,
	          5: pass,
	          6: crypted,
	          7: image,
	          8: a1,
	          9: a2,
	          10: a3,
	          11: 3,
	          12: 3
	      	});
	      	console.log("KDS ticket created");
	      	io.sockets.emit("update-people", {people: people, count: sizePeople, type: chat_id, user: people[socket.id].name , seller:1, roomID:roomID});
		}
	});

	//User setting functions
	socket.on("set_user", function( pass, roomID, curUser, image, interest,a1,a2,a3) {
		
		var sqlite3 = require('sqlite3').verbose();
		var db = sqlite3_db("http://192.168.10.110/ichatmn-web/ichat.db");
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
