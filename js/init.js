var isRodeSelected = false;
var timestampStart;
var timestampStop;

var selectedRode;

// $("body").height(window.innerHeight);

$(document).on("click", "#login_btn", function () {
   // do login
   
    const Http = new XMLHttpRequest();
    var url='https://www.arcgis.com/sharing/generateToken?username={0}&password={1}&referer=*&f=json';
    var un = $("#username").val();
    var pw = $("#password").val();
    var parsedUrl = url.replace("{0}", un).replace("{1}", pw);

    Http.open("GET", parsedUrl);
    Http.send();
    Http.onreadystatechange=(e)=>{
        
        if (Http.responseText) {
            var parsedRes = JSON.parse(Http.responseText);        
            if (parsedRes && parsedRes.token) {
                sessionStorage.setItem("broyteAppToken", parsedRes.token);            
                showStep("step2");
                $("#userInfo").text("Hei Ståle Klommestein!")
            }
            else {
                $("#loginText").text("Brukernavn og/eller passord stemmer ikke.")
            }
        }
        else {
            $("#loginText").text("Brukernavn og/eller passord stemmer ikke.")
        }
    }
   
});

$(document).on("change", "#rodeDropdown", function (e) {
    var newVal = e.currentTarget.value;
    if (newVal) {
        isRodeSelected = true;
        selectedRode = newVal;
        showStep("step3");
        $("#timeInfoText").html("");
    }
    else {
        isRodeSelected = false;
        selectedRode = null;
    }
    $("#choosenRode").html(newVal);
    showStep("step3");
});

$(document).on("click", "#changeRode", function (e) {    
    timestampStop = Date.now();    
    var totalTime = timestampStop - timestampStart;
    $("#stopButton").click();
    showStep("step2");
});

$(document).on("click", "#startButton", function () {
    $("#startButton").hide();
    $("#stopButton").show();        
    
    timestampStart = Date.now();
    var timestampStartDateReadable = new Date(timestampStart).toLocaleDateString();
    var timestampStartTimeReadable = new Date(timestampStart).toLocaleTimeString();
    var startText = selectedRode + " ble startet brøytet<br/>" + timestampStartDateReadable + " " + timestampStartTimeReadable;
    $("#timeInfoText").html(startText);
    $("#counter").text("00:00:00");
    incrementSeconds();
    // Send timestamp kall api
});
$(document).on("click", "#stopButton", function () {
    $("#startButton").show();
    $("#stopButton").hide();
    
    timestampStop = Date.now();        
    var timestampStopDateReadable = new Date(timestampStop).toLocaleDateString();
    var timestampStopTimeReadable = new Date(timestampStop).toLocaleTimeString();
    
    var totalTimeReadable = diff_hours(timestampStart, timestampStop);    
    var stopText = selectedRode + " ble avsluttet<br/>" + timestampStopDateReadable + " " + timestampStopTimeReadable + "<br><br>Tid brukt: " + totalTimeReadable;
    $("#timeInfoText").html(stopText);    
    
});

$(document).on("click", "#mapToggleButton", function () {
    $("#showMap").toggle();
    $("#hideMap").toggle();
    
});


function diff_hours(startTime, stopTime) 
 {
    var diffInMs = stopTime - startTime;    

    var seconds = diffInMs / 1000;
    var hours = parseInt( seconds / 3600 ); 
    seconds = seconds % 3600; 
    var minutes = parseInt( seconds / 60 ); 
    seconds = Math.floor(seconds % 60);

    // var hours   = Math.floor(diffInMs / 3600);
    // var minutes = Math.floor(diffInMs / 60000)  
    // var seconds = ((diffInMs % 60000) / 1000).toFixed(0);  

    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    var outputTime = hours+':'+minutes+':'+seconds;
    return outputTime;
    //(new Date(stopTime).getTime() - new Date(startTime).getTime()) / 1000;  
 }

 function incrementSeconds() {
    var seconds = 0;
    
    setInterval(function () {
        var counter = diff_hours(timestampStart, Date.now())
        $("#counter").text(counter);
        seconds++;
    }, 1000);   
    
}

function showStep(id) {
    $("#step1").hide();
    $("#step2").hide();
    $("#step3").hide();
    $("#" + id).show();
}


