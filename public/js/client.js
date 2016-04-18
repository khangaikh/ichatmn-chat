/* HTML5 magic
- GeoLocation
- WebSpeech
*/

//WebSpeech API
var final_transcript = '';
var recognizing = false;
var last10messages = []; //to be populated later

if (!('webkitSpeechRecognition' in window)) {
  console.log("webkitSpeechRecognition is not available");
} else {
  var recognition = new webkitSpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onstart = function() {
    recognizing = true;
  };

  recognition.onresult = function(event) {
    var interim_transcript = '';
    for (var i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        final_transcript += event.results[i][0].transcript;
        $('#msg').addClass("final");
        $('#msg').removeClass("interim");
      } else {
        interim_transcript += event.results[i][0].transcript;
        $("#msg").val(interim_transcript);
        $('#msg').addClass("interim");
        $('#msg').removeClass("final");
      }
    }
    $("#msg").val(final_transcript);
    };
  }

  function startButton(event) {
    if (recognizing) {
      recognition.stop();
      recognizing = false;
      $("#start_button").prop("value", "Record");
      return;
    }
    final_transcript = '';
    recognition.lang = "en-GB"
    recognition.start();
    $("#start_button").prop("value", "Recording ... Click to stop.");
    $("#msg").val();
  }
//end of WebSpeech

/*
Functions
*/
function toggleNameForm() {
   $("#login-screen").toggle();
}

function toggleChatWindow() {
  $("#main-chat-screen").toggle();
}

// Pad n to specified size by prepending a zeros
function zeroPad(num, size) {
  var s = num + "";
  while (s.length < size)
    s = "0" + s;
  return s;
}

// Format the time specified in ms from 1970 into local HH:MM:SS
function timeFormat(msTime) {
  var d = new Date(msTime);
  return zeroPad(d.getHours(), 2) + ":" +
    zeroPad(d.getMinutes(), 2) + ":" +
    zeroPad(d.getSeconds(), 2) + " ";
}

// Format the time specified in ms from 1970 into local HH:MM:SS
function hello(caller) {
  var d = new Date(msTime);
  return zeroPad(d.getHours(), 2) + ":" +
    zeroPad(d.getMinutes(), 2) + ":" +
    zeroPad(d.getSeconds(), 2) + " ";
}

 
$(document).ready(function() {

  var lock= new PatternLock('#patternHolder',{matrix:[5,5]});
  var lock1= new PatternLock('#patternHolder1',{matrix:[5,5]});
    
  var ip_run = 'localhost'; //159.203.105.18
  //setup "global" variables first
  var socket = io.connect("127.0.0.1:8080");
  var myRoomID = null;
  var privateRoomID = null;
  var curUser = null;
  $("#private_actions").hide();
  $("#private_conversation").hide();
  $("#private_chatForm").hide();

  socket.on('connect', function(){

    var delivery = new Delivery(socket);
 
    delivery.on('delivery.connect',function(delivery){
      $("#upload[type=submit]").click(function(evt){

        var file = $("input[type=file]")[0].files[0];
        var extraParams = {roomID: privateRoomID};
        delivery.send(file,extraParams);
        var msg = "File Uploaded";
        socket.emit("private_send", new Date().getTime(), msg);
        evt.preventDefault();
      });
    });
 
    delivery.on('send.success',function(fileUID){
      $('#uploadFile').modal('toggle');
      console.log("file was successfully sent.");
    });

    delivery.on('receive.start',function(fileUID){
      console.log('receiving a file!');
    });
 
    delivery.on('receive.success',function(file,roomID){
      if (file.isImage()) {
        $('img').attr('src', file.dataURL());
        $('#getFileModal').toggle();
      };
    });
  });

  $("form").submit(function(event) {
    event.preventDefault();
  });

  $("#conversation").bind("DOMSubtreeModified",function() {
    $("#conversation").animate({
        scrollTop: $("#conversation")[0].scrollHeight
      });
  });

  $("#file_pass").keypress(function(e){
    var name = $("#file_pass").val();
    if(name.length < 2) {
        $("#uploadForm").hide();
        $("#errors1").empty();
        $("#errors1").show();
        $("#errors1").append("Please enter password to upload file");
    } else {
      $("#uploadForm").show();
      $("#errors1").empty();
      $("#errors1").hide();
    }
  });

  $("#main-chat-screen").hide();
  $("#errors").hide();
  $("#name").focus();
  $("#join").attr('disabled', 'disabled'); 
  
  if ($("#name").val() === "") {
    $("#join").attr('disabled', 'disabled');
  }

  //enter screen
  $("#nameForm").submit(function() {
    var name = $("#name").val();
    var device = "desktop";
    if (navigator.userAgent.match(/Android|BlackBerry|iPhone|iPad|iPod|Opera Mini|IEMobile/i)) {
      device = "mobile";
    }
    if (name === "" || name.length < 2) {
      $("#errors").empty();
      $("#errors").append("Please enter a name");
      $("#errors").show();
    } else {
      var url = window.location.href; 
      socket.emit("joinserver", name, device, url);
      toggleNameForm();
      toggleChatWindow();
      $("#msg").focus();
    }
  });

  $("#name").keypress(function(e){
    var name = $("#name").val();
    if(name.length < 2) {
      $("#join").attr('disabled', 'disabled'); 
    } else {
      $("#errors").empty();
      $("#errors").hide();
      $("#join").removeAttr('disabled');
    }
  });

  //main chat screen
  $("#chatForm").submit(function() {
    var msg = $("#msg").val();
    if (msg !== "") {
      socket.emit("send", new Date().getTime(), msg);
      $("#msg").val("");
    }
  });

  //private chat screen
  $("#private_chatForm").submit(function() {
    var msg = $("#private_msg").val();
    if (msg !== "") {
      socket.emit("private_send", new Date().getTime(), msg);
      $("#private_msg").val("");
    }
  });

  //'is typing' message
  var typing = false;
  var timeout = undefined;

  function timeoutFunction() {
    typing = false;
    socket.emit("typing", false);
  }

  $("#msg").keypress(function(e){
    if (e.which !== 13) {
      if (typing === false && myRoomID !== null && $("#msg").is(":focus")) {
        typing = true;
        socket.emit("typing", true);
      } else {
        clearTimeout(timeout);
        timeout = setTimeout(timeoutFunction, 5000);
      }
    }
  });


  $("#private_msg").keypress(function(e){
    if (e.which !== 13) {
      if (typing === false && privateRoomID !== null && $("#private_msg").is(":focus")) {
        typing = true;
        socket.emit("typing", true);
      } else {
        clearTimeout(timeout);
        timeout = setTimeout(timeoutFunction, 5000);
      }
    }
  });

  socket.on("isTyping", function(data) {
    if (data.isTyping) {
      if ($("#"+data.person+"").length === 0) {
        $("#updates").append("<li id='"+ data.person +"'><span class='text-muted'><small><i class='fa fa-keyboard-o'></i> " + data.person + " is typing.</small></li>");
        timeout = setTimeout(timeoutFunction, 5000);
      }
    } else {
      $("#"+data.person+"").remove();
    }
  });

  $("#showCreateRoom").click(function() {
    $("#createRoomForm").toggle();
  });

  $("#createRoomBtn").click(function() {
    var roomExists = false;
    var roomName = $("#createRoomName").val();
    var invite = $("#users").val();
    socket.emit("check", roomName, function(data) {
      roomExists = data.result;
       if (roomExists) {
          $("#errors").empty();
          $("#errors").show();
          $("#errors").append("Room <i>" + roomName + "</i> already exists");
        } else {      
        if (roomName.length > 0) { //also check for roomname
          socket.emit("createRoom", roomName, invite);
          $("#errors").empty();
          $("#private_actions").show();
          $("#errors").hide();
          }
        }
    });
  });

  $("#sendImage").click(function(e) {
    var a1 = $("#ans1").val();
    var a2 = $("#ans2").val();
    var a3 = $("#ans3").val();

    if(a1=="" || a2=="" || a3==""){
        alert("Please fill your answers");
        e.preventDefault();
        return;
    }else{
      $("#createRoomForm-1").hide();
      $("#sendImage").hide();
      $("#sendImage1").show();
      $("#image-upload-1").show();
      var url = 'http://image.baidu.com/search/index?tn=baiduimage&ie=utf-8&word='+a3;
      var win = window.open(url, '_blank');

      var url = 'http://image.baidu.com/search/index?tn=baiduimage&ie=utf-8&word='+a2;
      var win = window.open(url, '_blank');

      var url = 'http://image.baidu.com/search/index?tn=baiduimage&ie=utf-8&word='+a1;
      var win = window.open(url, '_blank');
      

      if(win){
          //Browser has allowed it to be opened
          win.focus();
      }else{
          //Broswer has blocked it
          alert('Please allow popups for this site');
      }
    }
  });

  $("#sendImage3").click(function(e) {
    var a1 = $("#ans11").val();
    var a2 = $("#ans21").val();
    var a3 = $("#ans31").val();

    if(a1=="" || a2=="" || a3==""){
        alert("Please fill your answers");
        e.preventDefault();
        return;
    }else{
      $("#createRoomForm-2").hide();
      $("#sendImage3").hide();
      $("#sendImage4").show();
      $("#image-upload-3").show();
      var url = 'http://image.baidu.com/search/index?tn=baiduimage&ie=utf-8&word='+a3;
      var win = window.open(url, '_blank');

      var url = 'http://image.baidu.com/search/index?tn=baiduimage&ie=utf-8&word='+a2;
      var win = window.open(url, '_blank');

      var url = 'http://image.baidu.com/search/index?tn=baiduimage&ie=utf-8&word='+a1;
      var win = window.open(url, '_blank');
      if(win){
          //Browser has allowed it to be opened
          win.focus();
      }else{
          //Broswer has blocked it
          alert('Please allow popups for this site');
      }
    }
  });

  $("#sendImage1").click(function(e) {

      var user_link = $("#userPhoto").val();
      if(user_link==""){
        alert("Please select your photo and paste it here");
        e.preventDefault();
        return;
      }
      $("#image-upload-1").hide(); 
      $("#image-upload-2").show();
      $("#patternHolder").css('background', 'url(' + user_link + ')');  
      $("#patternHolder").css('background-size', 'contain');   
      $("#sendImage1").hide();
      $("#createKey").show();
      $("#clearing").show();
  });

  $("#sendImage4").click(function(e) {

      var user_link = $("#userPhoto1").val();
      if(user_link==""){
        alert("Please select your photo and paste it here");
        e.preventDefault();
        return;
      }
      $("#image-upload-3").hide(); 
      $("#image-upload-4").show();
      $("#patternHolder1").css('background-image', 'url(' + user_link + ')');  
      $("#patternHolder1").css('background-size', 'contain');   
      $("#sendImage3").hide();
      $("#createSeller").show();
      $("#clearing").show();
  });
    
  $("#saveKey").click(function() {
    // save canvas image as data url (png format by default)
    var roomID = privateRoomID;
    var dataURL = canvas[0].toDataURL();
    socket.emit("save_key", curUser, myRoomID, dataURL);
    ctx.clearRect(0, 0, 1500, 600);

  });

  $("#finish").click(function() {
    if (confirm('Are you sure to finish trading info?')) {
        var roomID = privateRoomID;
        socket.emit("finish", curUser, roomID);
    }
    // save canvas image as data url (png format by default)
  });

  $("#clearing").click(function() {

   
   lock.reset();

  });

  $("#discard").click(function() {
      $("#ans1").val("");
      $("#ans2").val("");
      $("#ans3").val("");
      $("#createRoomForm-1").show();
      $("#sendImage").show();
      $("#sendImage1").hide();
      $("#clearing").hide();
      $("#createKey").hide();
      $("#image-upload-1").hide();
      $("#image-upload-2").hide();
  });

  $("#createSeller").click(function() {

   var pattern = lock1.getPattern(); 

    var arr = pattern.split('-');
    var pass=arr[0];
    var temp =arr[0];
    console.log(pattern);
    console.log(arr);
    for(var i=0; i<arr.length; i++){
      if(arr[i]!=temp){
        temp=arr[i];
        pass = pass+''+temp;  
      }
    }
    console.log(pass);

    var roomID = privateRoomID;
    var a1 = $("#ans11").val();
    var a2 = $("#ans21").val();
    var a3 = $("#ans31").val();
    var user_link = $("#userPhoto1").val();
    
    console.log(a1);
    console.log(a2);
    console.log(a3);
    $("#fileupload").show();
    socket.emit("set_user", pass, roomID, curUser, user_link, 1, a1,a2,a3);
  });

  $("#createKey").click(function() {

    var pattern = lock.getPattern(); 

    var arr = pattern.split('-');
    var pass=arr[0];
    var temp =arr[0];
    console.log(pattern);
    console.log(arr);
    for(var i=0; i<arr.length; i++){
      if(arr[i]!=temp){
        temp=arr[i];
        pass = pass+''+temp;  
      }
    }
    console.log(pass);
    var user_link = $("#userPhoto").val();
    var interest = $("#interest").val();
    var roomID = privateRoomID;
    var a1 = $("#ans1").val();
    var a2 = $("#ans2").val();
    var a3 = $("#ans3").val();
    var user_link = $("#userPhoto").val();

    socket.emit("save_user", interest, '1', '1', pass, roomID, curUser, a1, a2, a3, user_link, function(data) {
       alert(data);
       if (data == 1) {
          //Seller
           $("#private_msgs").append("<li> <a href='#' data-toggle='modal' data-target='#modalBuyer' > Send buyer for notify </a></li>");
        } else {      
          //Buyer
           $("#private_msgs").append("<li> <a href='#' data-toggle='modal' data-target='#modalSeller' > Send seller for notify </a></li>");
        }
    });
  });

  $("#rooms").on('click', '.joinRoomBtn', function() {
    var roomName = $(this).siblings("span").text();
    var roomID = $(this).attr("id");
    socket.emit("joinRoom", roomID);
  });

  $("#rooms").on('click', '.removeRoomBtn', function() {
    var roomName = $(this).siblings("span").text();
    var roomID = $(this).attr("id");
    socket.emit("removeRoom", roomID);
    $("#createRoom").show();
  }); 

  $("#leave").click(function() {
    var roomID = myRoomID;
    socket.emit("leaveRoom", roomID);
    $("#createRoom").show();
  });

  $("#people").on('click', '.whisper', function() {
    var name = $(this).siblings("span").text();
    $("#msg").val("w:"+name+":");
    $("#msg").focus();
  });

  //socket-y stuff
  socket.on("exists", function(data) {
    $("#errors").empty();
    $("#errors").show();
    $("#errors").append(data.msg + " Try <strong>" + data.proposedName + "</strong>");
  });

  socket.on("joined", function() {
    $("#errors").hide();
    if (navigator.geolocation) { //get lat lon of user
      navigator.geolocation.getCurrentPosition(positionSuccess, positionError, { enableHighAccuracy: true });
    } else {
      $("#errors").show();
      $("#errors").append("Your browser is ancient and it doesn't support GeoLocation.");
    }
    function positionError(e) {
      console.log(e);
    }

    function positionSuccess(position) {
        var lat = position.coords.latitude;
        var lon = position.coords.longitude;
        //consult the yahoo service
        $.ajax({
          type: "GET",
          url: "http://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20geo.placefinder%20where%20text%3D%22"+lat+"%2C"+lon+"%22%20and%20gflags%3D%22R%22&format=json",
          dataType: "json",
           success: function(data) {
            socket.emit("countryUpdate", {country: data.query.results.Result.countrycode});
          }
        });
      }
    });

    $("#show_finish").on('click', function(){
      alert(1);
      $("#finish"),show();
    });

    socket.on("history", function(data) {
      if (data.length !== 0) {
        $("#msgs").append("<li><strong><span class='text-warning'>Last 10 messages:</li>");
        $.each(data, function(data, msg) {
          $("#msgs").append("<li><span class='text-warning'>" + msg + "</span></li>");
        });
      } else {
        $("#msgs").append("<li><strong><span class='text-warning'>No past messages in this room.</li>");
      }
    });

    socket.on("update", function(msg) {
      $("#msgs").append("<li>" + msg + "</li>");
    });

    socket.on("update_private", function(msg) {
      $("#private_conversation").show();
      $("#private_chatForm").show();
      $("#private_msgs").append("<li>" + msg + "</li>");
    });

    socket.on("update_private_msg", function(msg) {
      $("#private_msg").val(msg);
    });

    socket.on("update-people", function(data){
      //var peopleOnline = [];
      $("#people").empty();
      $("#users").empty();
      $('#people').append("<li class=\"list-group-item active\">People online <span class=\"badge\">"+data.count+"</span></li>");
      var type = data.type;
      var name = $("#me").val();
      $.each(data.people, function(a, obj) {
        if(obj.type === type ){
          if (!("country" in obj)) {
            html = "";
          } else {
            html = "<img class=\"flag flag-"+obj.country+"\"/>";
          }
          $('#people').append("<li class=\"list-group-item\"><span>" + obj.name + "</span> <i class=\"fa fa-"+obj.device+"\"></i> " + html + " <a href=\"#\" class=\"whisper btn btn-xs\">private msg</a></li>");
          if(obj.name != name){
            $('#users').append("<option value="+obj.name+"><span>" + obj.name + "</span></option>");  
          }
            
        }
        //peopleOnline.push(obj.name);
      });

      /*var whisper = $("#whisper").prop('checked');
      if (whisper) {
        $("#msg").typeahead({
            local: peopleOnline
        }).each(function() {
           if ($(this).hasClass('input-lg'))
                $(this).prev('.tt-hint').addClass('hint-lg');
        });
      }*/
    });

    socket.on("chat", function(msTime, person, msg, file) {
      if(file==0){
        $("#msgs").append("<li><strong><span class='text-success'>" + timeFormat(msTime) + person.name + "</span></strong>: " + msg + "</li>");
      }else{
        $("#msgs").append("<li><strong><span class='text-success'>" + timeFormat(msTime) + person.name + "</span></strong>: <a href='#' class=\"getfiles\" onclick=' socket.emit('getFile','"+msg+"');'>"+msg+"</a></li>");
      }
      
      //clear typing field
       $("#"+person.name+"").remove();
       clearTimeout(timeout);
       timeout = setTimeout(timeoutFunction, 0);
    });

    socket.on("private_chat", function(msTime, person, msg, file) {
      if(file==0){
        $("#private_msgs").append("<li>" + timeFormat(msTime) + person.name + "</span></strong>: " + msg + "</li>");
      }else if(file==2){
        $("#private_msgs").append("<li>"+ timeFormat(msTime) + person.name +"<a href='#'> Seller set up your info for trade room. Buyer has finished his. </a></li>");
      }
      else if(file==3){
        $("#private_msgs").append("<li>"+ timeFormat(msTime) + person.name +"<a href='#' id='show_finish'> Buyer you are ready to finish the private chat. Seller uploaded the secret file </a></li>");
        $("#buyerFinish").show();        
      }
      else if(file==5){
        $("#private_msgs").append("<li>"+ timeFormat(msTime) + person.name +"<a href="+msg+" target='_blank'> Notify to other end </a></li>");
      }
      else{
        $("#private_msgs").append("<li>" + timeFormat(msTime) + person.name + "</span></strong>: <a href='#' class=\"getfiles\" onclick=' socket.emit('getFile','"+msg+"');'>"+msg+"</a></li>");
      }
      
      //clear typing field
       $("#"+person.name+"").remove();
       clearTimeout(timeout);
       timeout = setTimeout(timeoutFunction, 0);
    });

    socket.on("whisper", function(msTime, person, msg) {
      if (person.name === "You") {
        s = "private messaeged"
      } else {
        s = "private messaeged"
      }
      $("#msgs").append("<li><strong><span class='text-muted'>" + timeFormat(msTime) + person.name + "</span></strong> "+s+": " + msg + "</li>");
    });

    socket.on("roomList", function(data) {
      $("#rooms").text("");
      $("#rooms").append("<li class=\"list-group-item active\">List of rooms <span class=\"badge\">"+data.count+"</span></li>");
       if (!jQuery.isEmptyObject(data.rooms)) { 
        var type = data.type; 
        console.log("chat :"+ type);
        $.each(data.rooms, function(id, room) {
          if(room.chat == type){
            console.log("roomchat :"+ curUser);
            console.log("invitee :"+ room.invited);
            var html ="";
            if(room.invited == curUser ){
               var html = "<button id="+id+" class='joinRoomBtn btn btn-default btn-xs' >Join</button>";
            }
            $('#rooms').append("<li id="+id+" class=\"list-group-item\"><span>" + room.name + "</span> " + html + "</li>");
          }
          
        });
      } else {
        $("#rooms").append("<li class=\"list-group-item\">There are no rooms yet.</li>");
      }
    });

    socket.on("sendRoomID", function(data) {
      myRoomID = data.id;
    });

    socket.on("sendprivateRoomID", function(data) {
      privateRoomID = data.id;
    });


    socket.on("show_actions", function(data) {
      $("#private_actions").show();
    });
    socket.on("show_file_upload", function(data) {
      $("#sellerFile").show();
    });

    socket.on("show_seller_actions", function(data) {
      $("#seller_actions").show();
    })

    socket.on("sendUser", function(data) {
      curUser = data.user;
    });

    socket.on("setme", function(data) {
      $("#me").val(data.name);
    });

    socket.on("disconnect", function(){
      $("#msgs").append("<li><strong><span class='text-warning'>The server is not available</span></strong></li>");
      $("#msg").attr("disabled", "disabled");
      $("#send").attr("disabled", "disabled");
    });

});
