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
} 
else {
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

function toggleNameForm() {
   $("#login-screen").toggle();
}

function toggleChatWindow() {
  $("#main-chat-screen").toggle();
  $("#main-header").toggle();
}

function zeroPad(num, size) {
  var s = num + "";
  while (s.length < size)
    s = "0" + s;
  return s;
}


function timeFormat(msTime) {
  var d = new Date(msTime);
  return zeroPad(d.getHours(), 2) + ":" +
    zeroPad(d.getMinutes(), 2) + ":" +
    zeroPad(d.getSeconds(), 2) + " ";
}

function makeid(){
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < 5; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

function hello(caller) {
  var d = new Date(msTime);
  return zeroPad(d.getHours(), 2) + ":" +
    zeroPad(d.getMinutes(), 2) + ":" +
    zeroPad(d.getSeconds(), 2) + " ";
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


$(document).ready(function() {

  var lock= new PatternLock('#patternHolder',{matrix:[5,5]});
  var lock1= new PatternLock('#patternHolder1',{matrix:[5,5]});
    
  var ip_run = '192.168.10.124'; //159.203.105.18
  //setup "global" variables first
  var socket = io.connect(ip_run+":8080");
  var myRoomID = null;
  var privateRoomID =  makeid();
  var curUser = null;
  var curType = 0;
  var global_room = null;

  $("#private_actions").hide();
  $("#private_conversation").hide();
  $("#private_chatForm").hide();

  socket.on('connect', function(){

    var delivery = new Delivery(socket);
 
    delivery.on('delivery.connect',function(delivery){
     
      $("#upload[type=submit]").click(function(evt){

        var file = $("#secretFile")[0].files[0];
        var pass = $("#file_pass").val();
        privateRoomID  = $("#me").val();
        
        var extraParams = {roomID: privateRoomID, type:1, passKey: pass};
        delivery.send(file,extraParams);
        var msg = "File Uploaded";
        
        evt.preventDefault();
      });

      $("#upload1[type=submit]").click(function(evt){

        //var file1 = $("#encryptedFile")[0].files[0];
        var file1 = $("#permissionFile")[0].files[0];
        
        var ip_1 = $("#encryptedFile1").val();
        var ip_2= $("#encryptedFile7").val();
        var ip_3 = $("#encryptedFile8").val();

        if(ip_1 && ip_2){

          var extraParams = {roomID: privateRoomID, ip1:ip_1, ip2:ip_2, ip3:ip_3, type:2};
          delivery.send(file1,extraParams);

          var msg = "File Uploaded";
          //socket.emit("private_send", new Date().getTime(), msg);
          evt.preventDefault();
        }else{
          alert("Please select secret IPS");
        }
      });

    });
 
    delivery.on('send.success',function(fileUID){
      var params = fileUID.params;

      if(params.type==1){
        $('#uploadFile').modal('toggle');
      }
      if(params.type==2){
        $('#getFileModal').modal('toggle');
      }
      if(params.type==3){
        $('#getFileModal2').modal('toggle');
      }

      console.log("file was successfully sent.");
    });

    delivery.on('receive.start',function(fileUID){
        console.log('receiving a file!');
    });
 
    delivery.on('receive.success',function(file,roomID){
      if (file.isImage()) {
        $('img').attr('src', file.dataURL());
        //$('#getFileModal').toggle();
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

  $('#file_pass').on('input', function(){
    var name = $("#file_pass").val();
    if(name.length < 9) {
        $("#uploadForm").hide();
        $("#errors1").empty();
        $("#errors1").show();
        $("#errors1").append("Please enter password at least 10 charactor long to upload file");
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

      var crypted = Encrypt(msg)

      console.log(crypted);

      socket.emit("private_send", new Date().getTime(), crypted);
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
    var interest = $("#intererstType").val();
    var invite = $("#users").val();
    socket.emit("check", roomName, function(data) {
      roomExists = data.result;
       if (roomExists) {
          $("#errors").empty();
          $("#errors").show();
          $("#errors").append("Room <i>" + roomName + "</i> already exists");
        } else {      
        if (roomName.length > 0) { //also check for roomname
          socket.emit("createRoom", roomName, invite, curUser, interest);
          $("#no-show").hide();
          $("#no-show2").hide();
          $("#errors").empty();
          $("#private_actions").show();
          $("#errors").hide();
          }
        }
    });
  });

  $("#distribute").click(function() {

    var type = $("#encrypt_type").val();
    var recover = $("#recover_type").val();
    var roomID = $("#me").val();

    socket.emit("distribute", roomID, function(data) {
    });
  });

  $("#sendImage").click(function(e) {
    
    var a1 = $("#ans1").val();
    var a2 = $("#ans2").val();
    var a3 = $("#ans3").val();

    if(a1=="" || a2=="" || a3=="" || a1.length<4 || a2.length<4 || a3.length<4 || a1.length>26 || a2.length>26 || a3.length>26){
        alert("Please fill your answers answer shoudl be at least 4 and less then 26");
        e.preventDefault();
        return;
    }else{
      $("#createRoomForm-1").hide();
      $("#sendImage").hide();
      $("#sendImage1").show();
      $("#buyer_step_1").hide();
      $("#buyer_step_2").show();
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

    if(a1=="" || a2=="" || a3=="" || a1.length<4 || a2.length<4 || a3.length<4 || a1.length>26 || a2.length>26 || a3.length>26){
        alert("Please fill your answers. Answer must be at least 4 letters long and at most 26 letter");
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
      $("#buyer_step_2").hide();
      $("#buyer_step_3").show();
      $("#patternHolder").css('background', 'url(' + user_link + ')');  
      $("#patternHolder").css('background-size', 'contain');   
      $("#sendImage1").hide();
      $("#createKey").show();
      $("#clearing").show();
  });

  $("#clickdownload").click(function(e) {
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
        var roomID = $("#me").val();
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

    var roomID = $("#me").val();

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

    var roomID = privateRoomID;

    var a1 = $("#ans1").val();
    var a2 = $("#ans2").val();
    var a3 = $("#ans3").val();
    var user_link = $("#userPhoto").val();

    socket.emit("save_user", 2, '1', '1', pass, roomID, curUser, a1, a2, a3, user_link, function(data) { 
      if(data==1){
        console.log("Seller actions show"+data);
        if(curUser=='seller'){
          $("#sellerActions").show();
        }
      }
    });
  });

  $("#rooms").on('click', '.joinRoomBtn', function() {
    var roomName = $(this).siblings("span").text();
    var roomID = $(this).attr("id");
    $("#no-show2").hide();
    $("#no-show").hide();
    socket.emit("changeText", roomID);
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
    $("#main-chat-screen").hide();
    setTimeout(function(){
      window.location.reload();
    }, 3000);
  });

  socket.on("joined", function() {
    
    $("#errors").hide();

    if (navigator.geolocation) { //get lat lon of user
      navigator.geolocation.getCurrentPosition(positionSuccess, positionError, { enableHighAccuracy: true });
    } 
    else {
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

    socket.on("seller_feed", function(msg) {
      console.log(msg);
      var obj = $.parseJSON(msg);
      $("#seller_secret_ips").empty();
      $("#seller_secret_ips").append("<p><strong>Step 2:</strong> Your secret key is stored on following servers</p>");
        for (var i = 0; i < obj.length; i++) {
            var text = "<p>Host "+i+": "+obj[i].ip+" secret key: "+obj[i].secret+"</p>";
            $("#seller_secret_ips").append(text);
        }  
        $("#getFileModal").modal("toggle");
        $("#sellerFinish").show();
    });


    socket.on("update_private_msg", function(msg) {
      
       $("#private_msg").val(msg);
    });

    socket.on("update_msg", function(msg) {
       $("#msg").val(msg);
    });

    socket.on("update_seller", function(msg) {
       $("#seller_stepii").append("<p><strong>Step 1: </strong>Please download your encrypted file :<a href='http://"+ip_run+"/ichatmn-web/upload/"+msg+"/file.pub' download='proposed_file_name'>Download now</a></p>");
       $("#sellerKey").show();
    });

    socket.on("update-people", function(data){
      //var peopleOnline = [];
      $("#people").empty();
      $("#users").empty();
      $('#people').append("<li class=\"list-group-item active\">People online <span class=\"badge\">"+data.count+"</span></li>");
      
      var type = data.type;
      var name = $("#me").val();

      var seller = data.seller;
      console.log("*********: "+seller);

      if(curType == 'seller'){
        $("#typeHello").html("Hello Seller");
        $("#sellerWindow").show();
        //$("#sellerActions").show();
        if(seller == 1){
          $("#sellerActions").show();
          $("#me").val(data.roomID);
        }
      }else{
        $("#typeHello").html("Hello Buyers");
        $("#buyerActions").show();
        if(seller == 1){
          $("#me").val(data.roomID);
        }
      }

      $.each(data.people, function(a, obj) {   
        if(obj.type != 0){
            $('#people').append("<li class=\"list-group-item\"><span>" + obj.name + "</span> <i class=\"fa fa-"+obj.device +"\"></i> "+obj.type+" <a href=\"#\" class=\"whisper btn btn-xs\">private msg</a></li>");
            if(obj.name != name){
                $('#users').append("<option value="+obj.name+"><span>" + obj.name + "</span></option>");  
            }
        }
      });
    });

    socket.on("chat", function(msTime, person, msg, file) {
      if(file==0){
        $("#msgs").append("<li><strong><span class='text-success'>" + timeFormat(msTime) + person.name + "</span></strong>: " + msg + "</li>");
      }else if(file==7){
        $("#msgs").append("<li> <strong><span class='text-success'>"+ timeFormat(msTime) + person.name +"</span></strong>: <a href='/file?item="+msg+"' target='_blank'> Download file </a></li>");     
      }
      else if(file==6){
        var item1 = external_hosts[Math.floor(Math.random()*external_hosts.length)];
        var item2 = external_hosts[Math.floor(Math.random()*external_hosts.length)];
        var item3 = external_hosts[Math.floor(Math.random()*external_hosts.length)];

        $("#msgs").append("<li> <strong><span class='text-success'>"+ timeFormat(msTime) + person.name +"</span></strong>: <a href='/download?item="+msg+"' target='_blank'> Encrypted file </a> IPS: "+item1+", "+item2+", "+item3+"</li>");
      }
      else if(file == 3){
         $("#msgs").append("<li><strong><span class='text-success'>" + timeFormat(msTime) + person.name + "</span></strong>: <a href="+msg+">Trade room link</a></li>");
      }
      else{
        $("#msgs").append("<li><strong><span class='text-success'>" + timeFormat(msTime) + person.name + "</span></strong>: <a href='#' class=\"getfiles\" onclick=' socket.emit('getFile','"+msg+"');'>"+msg+"</a></li>");
      }
      
      //clear typing field
       $("#"+person.name+"").remove();
       clearTimeout(timeout);
       timeout = setTimeout(timeoutFunction, 0);
    });

    socket.on("private_chat", function(msTime, person, msg, file) {
      msg = Decrypt(msg);
      console.log(msg);
      if(file==0){
        $("#private_msgs").append("<li>" + timeFormat(msTime) + person.name + "</span></strong>: " + msg + "</li>");
      }else if(file==2){
        $("#private_msgs").append("<li>"+ timeFormat(msTime) + person.name +"<a href='#'> Seller set up your info for trade room. Buyer has finished his. </a></li>");

        $("#sellerActions").show();
      }
      else if(file==3){
        $("#private_msgs").append("<li>"+ timeFormat(msTime) + person.name +"<a href='#' id='show_finish'> Buyer you are ready to finish the private chat. Seller uploaded the secret file </a></li>");
        $("#buyerFinish").show();        
      }
      else if(file==5){
        $("#private_msgs").append("<li>"+ timeFormat(msTime) + person.name +"<a href="+msg+" target='_blank'> Notify to other end </a></li>");
      }
      else if(file==6){
        $("#private_msgs").append("<li>"+ timeFormat(msTime) + person.name +"<a href='/download?item="+msg+"' target='_blank'> Encrypted file </a><br /><a href='/permission?item="+msg+"' target='_blank'> Permission file </a></li>");
      }
      else if(file==7){
        $("#private_msgs").append("<li>"+ timeFormat(msTime) + person.name +"<a href='/file?item="+msg+"' target='_blank'> Download file </a></li>");
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
      $("#rooms").append("<li class=\"list-group-item active\">List of chat topics <span class=\"badge\">"+data.count+"</span></li>");
       if (!jQuery.isEmptyObject(data.rooms)) { 
        var type = data.type; 
        console.log("chat :"+ type);
        $.each(data.rooms, function(id, room) {
          if(room.chat == type && id!=1){
            console.log("roomchat :"+ curUser);
            console.log("invitee :"+ room.invited);
            var html ="";
            console.log("Owner");
            console.log(room.owner);
            console.log("curUser");
            console.log(curUser);

            if(room.created != curUser ){
              console.log(data.chatedId);
              console.log(id);
              console.log(room.id);
              console.log(room.chating);
                
              if(room.chating){
                var html = "<button style='float:right' id="+id+" class='joinRoomBtn1 btn btn-default btn-xs' >Chating</button>";
              }else{
                var html = "<button style='float:right' id="+id+" class='joinRoomBtn btn btn-default btn-xs' >Chat</button>";
              }
                  
                
    
            }else{
               var html = "<p style='float:right'>Owner</p>";
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
    });

    socket.on("show_seller_actions_1", function(data) {
      console.log("Seller actions show"+data);
      if(curUser=='seller'){
        $("#sellerActions").show();
      }
    });

    socket.on("sendUser", function(data) {
        curUser = data.user;
        curType = data.type;

        console.log("hi");
        console.log(curType);
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
