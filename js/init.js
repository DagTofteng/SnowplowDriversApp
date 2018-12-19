require([              
    "dojo/_base/array",
    "dojo/_base/lang",    
    "dojo/promise/all",
    "dojo/topic",
    "esri/Map",
    "esri/Basemap",
    "esri/WebMap",
    "esri/config",    
    "esri/geometry/Point",        
    "esri/geometry/ScreenPoint",        
    "esri/layers/FeatureLayer",
    "esri/views/MapView",
    "esri/widgets/ScaleBar",
    "esri/request",
    "esri/symbols/PictureMarkerSymbol",
    "esri/Graphic",
    "dojo/request/xhr",
    "esri/identity/OAuthInfo",
    "esri/identity/ServerInfo",        
    "esri/identity/IdentityManager",
    "esri/tasks/QueryTask",
    "esri/tasks/support/Query",
    "dojo/domReady!"
], function(
    array,
    lang,        
    all,
    topic,
    Map,
    Basemap,
    WebMap,
    esriConfig,                
    Point,
    ScreenPoint,
    FeatureLayer,
    MapView,
    ScaleBar,
    esriRequest,
    PictureMarkerSymbol,
    Graphic,
    xhr,
    OAuthInfo,
    ServerInfo,
    IdentityManager,
    QueryTask, 
    Query) {

    var featureServiceUrl = "https://services.arcgis.com/PdUYt91ohJfR04kk/arcgis/rest/services/Skedsmo_Br%C3%B8yteroder_WFL1/FeatureServer/";
    var featureServiceIDList = [0,1]; // 0 = linje, 1 = polygon
    var timestampStart;
    var timestampStop;
    var selectedRodeID;
    var selectedRodeText;
   
    // if (localStorage.getItem("broyteAppTokenExpiration")) {
    //     var tokenExpiration = localStorage.getItem("broyteAppTokenExpiration");
    //     if (!Date.now() > tokenExpiration) {

    //     }
    // }

    function initMapAndFeatureService(token) {        
        IdentityManager.registerToken({
            server: "https://testkommune.maps.arcgis.com/sharing/rest",
            token: token
        });

        var map = new WebMap({
        portalItem: {
            id: "4db252250bdb46338e49f7dbfc57c661"  
            }
        });        
        var view = new MapView({
            container: "map",
            map: map,                        
        });
        window.map = map;
        // Get unique Rodelist
        var query = new Query();
        query.returnGeometry = false;
        query.outFields = ["RodeID,RodeNavn"];
        query.returnDistinctValues = true;
        query.returnGeometry = false;
        query.where = "1=1"; 
        
        var rodeArray = [];
        
         // Kjør 2 queryTasker (mot linje og polygon)
         var numberOfQueryTasksCompleted = 0;

        array.forEach(featureServiceIDList, function (id) {                
        
            var queryTask = new QueryTask({
                url: featureServiceUrl + id + "?token=" + token
            });

           
            queryTask.execute(query).then(function(results){            
                array.forEach(results.features, function (item) {
                    if (item.attributes.RodeID && item.attributes.RodeNavn) {
                        var existInArray = false;
                        for(i = 0; i < rodeArray.length; i++) {
                            if (rodeArray[i].RodeID == item.attributes.RodeID && rodeArray[i].RodeNavn == item.attributes.RodeNavn) {
                                existInArray = true;
                                break;
                            }
                        }
                        if (!existInArray) {
                            rodeArray.push({ RodeID: item.attributes.RodeID, RodeNavn: item.attributes.RodeNavn });
                        }
                    }
                });
        
                rodeArray.sort();  
                numberOfQueryTasksCompleted++;
                if (numberOfQueryTasksCompleted == 2) {
                    buildRodeDropdown(rodeArray);
                }
                
                // queryTaskPolygon.execute(query).then(function(results){            
                //     array.forEach(results.features, function (item) {
                //         if (item.attributes.RodeID && item.attributes.RodeNavn) {
                //             var existInArray = false;
                //             for(i = 0; i < rodeArray.length; i++) {
                //                 if (rodeArray[i].RodeID == item.attributes.RodeID && rodeArray[i].RodeNavn == item.attributes.RodeNavn) {
                //                     existInArray = true;
                //                     break;
                //                 }
                //             }
                //             if (!existInArray) {
                //                 rodeArray.push({ RodeID: item.attributes.RodeID, RodeNavn: item.attributes.RodeNavn });
                //             }
                //         }
                //     });    
                //     rodeArray.sort();  
                //     numberOfQueryTasksCompleted++;          
                //     if (numberOfQueryTasksCompleted == 2) {
                //         buildRodeDropdown(rodeArray);
                //     }
                // }); 

            
            }); 
        
        });
        
    }

    function buildRodeDropdown(data) {
        var rodeDropdownHtml = "<option selected>Velg rode...</option>{0}";
        array.forEach(data, function (rode) {
            var optionHtml = "<option value='" + rode.RodeID + "'>" + rode.RodeNavn + "</option>";
            rodeDropdownHtml += optionHtml;
        });

        $("#rodeDropdown").html(rodeDropdownHtml);

        if (localStorage.getItem("broyteAppLastRodeID")) {
            var lastRodeID = localStorage.getItem("broyteAppLastRodeID");
            $("#rodeDropdown").val(lastRodeID).trigger("change");
            // var newValueText = $("#rodeDropdown").find("option:selected").text();
            // var newValueID = lastRodeID          
            // selectedRodeText = newValueText;
            // selectedRodeID = newValueID;
            // showStep("step3");
            // $("#choosenRode").html(newValueText);
            // $("#timeInfoText").html("");            
            }
        else {        
                selectedRodeText = null;
                selectedRodeID = null;
            }
    }
    

    $(document).on("click", "#login_btn", function () {
    // do login
    
        const Http = new XMLHttpRequest();
        var ref = window.location.origin;
        // Expiration 1440 = 1 døgn
        var url='https://www.arcgis.com/sharing/generateToken?username={0}&password={1}&referer={2}&expiration=1440&f=json';
        var un = $("#username").val();
        var pw = $("#password").val();    

        var parsedUrl = url.replace("{0}", un).replace("{1}", pw).replace("{2}", ref);

        Http.open("GET", parsedUrl);
        Http.send();
        Http.onreadystatechange=(e)=>{
            
            if (Http.responseText && Http.readyState == 4 && Http.status == 200) {
                var parsedRes = JSON.parse(Http.responseText);        
                if (parsedRes && parsedRes.token) {
                    sessionStorage.setItem("broyteAppToken", parsedRes.token);   
                    var expiration = new Date();
                    sessionStorage.setItem("broyteAppTokenExpiration", expiration);   

                    initMapAndFeatureService(parsedRes.token);        
                    
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
        var newValueText = $(this).find("option:selected").text();
        var newValueID = e.currentTarget.value;
        if (newValueText) {        
            selectedRodeText = newValueText;
            selectedRodeID = newValueID;
            showStep("step3");
            $("#timeInfoText").html("");
            localStorage.setItem("broyteAppLastRodeID", newValueID);        
        }
        else {        
            selectedRodeText = null;
            selectedRodeID = null;
        }
        $("#choosenRode").html(newValueText);
        showStep("step3");
    });

    $(document).on("click", "#changeRode", function (e) {    
        timestampStop = Date.now();    
        var totalTime = timestampStop - timestampStart;
        $("#stopButton").click();
        showStep("step2");
    });

    $(document).on("click", "#startButton", function () {
        updateFeatureService(selectedRodeID, "SisteStartTidspunkt");
        $("#startButton").hide();
        $("#stopButton").show();        
        
        timestampStart = Date.now();
        var timestampStartDateReadable = new Date(timestampStart).toLocaleDateString();
        var timestampStartTimeReadable = new Date(timestampStart).toLocaleTimeString();
        var startText = selectedRodeText + " ble startet brøytet<br/>" + timestampStartDateReadable + " " + timestampStartTimeReadable;
        $("#timeInfoText").html(startText);
        $("#counter").text("00:00:00");
        incrementSeconds();
        // Send timestamp kall api
    });
    $(document).on("click", "#stopButton", function (e) {
        if(e.hasOwnProperty('originalEvent')) {
        // Probably a real click.
            updateFeatureService(selectedRodeID, "SisteFerdigTidspunkt");
        }    
    
        $("#startButton").show();
        $("#stopButton").hide();
        
        timestampStop = Date.now();        
        var timestampStopDateReadable = new Date(timestampStop).toLocaleDateString();
        var timestampStopTimeReadable = new Date(timestampStop).toLocaleTimeString();
        
        var totalTimeReadable = diff_hours(timestampStart, timestampStop);    
        var stopText = selectedRodeText + " ble avsluttet<br/>" + timestampStopDateReadable + " " + timestampStopTimeReadable + "<br><br>Tid brukt: " + totalTimeReadable;
        $("#timeInfoText").html(stopText);    
        
    });

    $(document).on("click", "#mapToggleButton", function () {
        $("#showMap").toggle();
        $("#hideMap").toggle();
        $("#map").toggle();
        $("body").height(window.innerHeight - 150);
        
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

    function updateFeatureService(rodeId, fieldToUpdate) {
        var query = new Query();    
        query.returnGeometry = true;    
        query.outFields = ["*"];        
        query.where = "RodeID=" + rodeId; 
        
        var token = sessionStorage.getItem("broyteAppToken");
        var dateNow = Date.now();  
        array.forEach(featureServiceIDList, function (id) {        
            var queryTask = new QueryTask({
                url: featureServiceUrl + id + "?token=" + token
            });        
            
            queryTask.execute(query).then(function(results){   
                var layer = window.map.allLayers.find(function(layer) {
                    return layer.layerId === id;
                });
                var updateFeatures = [];
                
                array.forEach(results.features, function(rode) {  
                    var obj = rode;                
                    obj.attributes[fieldToUpdate] = dateNow;      
                    const updateFeature = new Graphic();
                    updateFeature.attributes = obj.attributes;
                    updateFeature.geometry = obj.geometry;
                    // Hvis ikke objektet har geometeri klarer vi ikke å oppdatere de. TODO: Fikse datagrunnlaget.
                    if (obj.geometry) {
                        updateFeatures.push(updateFeature);
                    }
                });
                const promise = layer.applyEdits({updateFeatures: updateFeatures}).then(function(result){             
                    var test = result;
                }); 
            });
        })        
    }     
    
});

