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
    "esri/widgets/Track",
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
    Query,
    Track) {

    var mapsSharingUrl = "https://testkommune.maps.arcgis.com/sharing/rest/";
    var featureServiceUrl = "https://services.arcgis.com/PdUYt91ohJfR04kk/arcgis/rest/services/Skedsmo_Br%C3%B8yteroder_WFL1/FeatureServer/";    
    var featureServiceIDList = [0,1]; // 0 = linje, 1 = polygon
    var featureServiceTableID = [2];        
    var timestampStart;
    var timestampStop;
    var selectedRodeID;
    var selectedRodeText;
    var timer;
    var rodeArray = [];
    var view;
    
   
    // if (localStorage.getItem("broyteAppTokenExpiration")) {
    //     var tokenExpiration = localStorage.getItem("broyteAppTokenExpiration");
    //     if (!Date.now() > tokenExpiration) {

    //     }
    // }

    function initMapAndFeatureService(token, userId) {        
        IdentityManager.registerToken({
            server: mapsSharingUrl,
            token: token
        });
        
        getUserInfo(userId).then(t => {
            var fullname = t.data.fullName;
            $("#userInfo").text(fullname)
        });
        
        var map = new WebMap({
        portalItem: {
            id: "4db252250bdb46338e49f7dbfc57c661"  
            }
        });        
        view = new MapView({
            container: "map",
            map: map,                        
        });
            // Create an instance of the Track widget
        // and add it to the view's UI
        // var track = new Track({
        //     view: view
        // });
        // view.ui.add(track, "top-left");            
        // view.when(function() {
        //     track.start();
        // });
        window.map = map;
        
        showStep("step2");
    }

    function getUserInfo(userId) {
        var getUserInfoUrl = mapsSharingUrl + "community/users/" + userId;
        var token = localStorage.getItem("broyteAppToken");
        if (token) {
            var request = esriRequest(getUserInfoUrl + "?token=" + token, {
                method: 'get',
                responseType: 'json',
                query: {
                f: 'json',
                }
            });
            return request;
        }
        return null;
    }

    function getRodeList() {
        var query = new Query();
        query.returnGeometry = false;
        query.outFields = ["RodeID,RodeNavn,SisteStartTidspunkt,SisteFerdigTidspunkt,Editor"];
        query.returnDistinctValues = true;
        query.returnGeometry = false;
        query.where = "1=1";    
        rodeArray = [];        
        executeQueryTask(query, combinePointAndPolygonData_rodeList, false);        
    }

  
    function getLatestDate(updateHistoryTable) {
        var query = new Query();
        query.returnGeometry = false;
        query.outFields = ["*"];
        query.returnDistinctValues = true;
        query.returnGeometry = false;
        query.where = "RodeID=" + selectedRodeID;    
        
        executeQueryTask(query, combinePointAndPolygonData_latestDate, updateHistoryTable);
    }


    
    function executeQueryTask(query, callbackFunction, updateHistoryTable) {
    var token = localStorage.getItem("broyteAppToken")
        // Kjør 2 queryTasker (mot linje og polygon)
     var numberOfQueryTasksCompleted = 0;
     array.forEach(featureServiceIDList, function (id) {                       
         var queryTask = new QueryTask({
             url: featureServiceUrl + id + "?token=" + token
         });
         
         queryTask.execute(query).then(function(results){    
            numberOfQueryTasksCompleted++;
            callbackFunction(results, numberOfQueryTasksCompleted, updateHistoryTable);
         }); 
     
     });
    }        

    function combinePointAndPolygonData_rodeList(results, numberOfQueryTasksCompleted) {     
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
                    var active = false;
                    var timestampLatestStart = new Date(item.attributes.SisteStartTidspunkt);
                    var timestampLatestStop = new Date(item.attributes.SisteFerdigTidspunkt);  
                    if (timestampLatestStart.getTime() > timestampLatestStop.getTime()) {
                        active = true;
                    };
                    rodeArray.push({ RodeID: item.attributes.RodeID, RodeNavn: item.attributes.RodeNavn, Active: active, Editor: item.attributes.Editor });
                }
            }
        });
        
        rodeArray.sort((a,b) => (a.RodeNavn > b.RodeNavn) ? 1 : ((b.RodeNavn > a.RodeNavn) ? -1 : 0));  
        if (numberOfQueryTasksCompleted == 2) {
            buildRodeListHTML(rodeArray);
        }
    };



    function buildRodeListHTML(data) {
        var rodeListHtml = "";
    
        array.forEach(data, function (rode) {
            var statusHtml = "<span class='status'></span>";
            var arrow = "<span class='arrow'><i class='fas fa-chevron-right'></i></span>";
            var statusAndArrow = "<div class='statusAndArrow'>" + statusHtml + arrow +"</div>";
            if (rode.Active) {
                var name = rode.Editor;
                getUserInfo(rode.Editor).then(r => {
                    if (r.data.fullName) {                    
                        name = r.data.fullName;
                        // <i class='fas fa-snowplow'></i>
                        $("#rodeList").find("a[data-value='" + rode.RodeID + "']").find(".status").html("Brøyting pågår (" + name + ")");                        
                    }                    
                });                
            }
            var listHtml = "<a href='#' data-text='" + rode.RodeNavn + "' data-value='" + rode.RodeID + "' class='list-group-item list-group-item-action text-left'>" + rode.RodeNavn + statusAndArrow +"</a>";
            rodeListHtml += listHtml;
        });

        $("#rodeList").html(rodeListHtml);

        if (localStorage.getItem("broyteAppLastRodeID")) {
            var lastRodeID = localStorage.getItem("broyteAppLastRodeID");
            $(("#rodeList").data("value") == lastRodeID).click();
        }
        else {        
                selectedRodeText = null;
                selectedRodeID = null;
            }
    }

    function combinePointAndPolygonData_latestDate(results, numberOfQueryTasksCompleted, updateHistoryTable) {     
        var latestPlowDateArray = [];    
        array.forEach(results.features, function (item) {
            if (item.attributes.SisteStartTidspunkt) {
                var existInArray = false;
                for(i = 0; i < latestPlowDateArray.length; i++) {
                    if (latestPlowDateArray[i].SisteStartTidspunkt == item.attributes.SisteStartTidspunkt) {
                        existInArray = true;
                        break;
                    }
                }
                if (!existInArray) {
                    latestPlowDateArray.push({ SisteStartTidspunkt: item.attributes.SisteStartTidspunkt, SisteFerdigTidspunkt: item.attributes.SisteFerdigTidspunkt });
                }
            }
        });

        if (latestPlowDateArray.length > 0) {
            var timestampLatestStart = new Date(latestPlowDateArray[0].SisteStartTidspunkt);
            var timestampLatestStop = new Date(latestPlowDateArray[0].SisteFerdigTidspunkt);
            var timestampLatestStartReadable = timestampLatestStart.toLocaleString();
            var timestampLatestStopReadable = timestampLatestStop.toLocaleString();
           
            $("#latestPlowStartDate").html(timestampLatestStartReadable);
            $("#latestPlowStopDate").html(timestampLatestStopReadable);                        
            
            if (timestampLatestStart.getTime() > timestampLatestStop.getTime()) {
                
                var now = new Date();    
                timestampStart = timestampLatestStart.getTime();
                var diff = diff_hours(timestampStart, now);  
                $("#alertBox #alertText").html("Brøyting pågår på valgt rode. <br/>Du må avslutte forrige før du kan starte en ny.");
                $("#alertBox").show();
                $("#startButton").hide();
                $("#stopButton").show();        
                
                var startText = selectedRodeText + " ble startet brøytet<br/>" + timestampLatestStartReadable;
                $("#timeInfoText").html(startText);
                $("#counter").text(diff);
                incrementSeconds(timestampLatestStart);
            }
            else {                
                $("#alertBox").hide();

            }

            if (updateHistoryTable) {
                var numberOfMs = (timestampLatestStop - timestampLatestStart);
                var numberOfMinutes = Math.floor((numberOfMs/1000)/60);
                var rodeID = results.features[0].attributes.RodeID;
                var rodeNavn = results.features[0].attributes.RodeNavn;
                updateFeatureServiceTable(rodeID, rodeNavn, timestampLatestStart, timestampLatestStop, numberOfMinutes);
            }

        }
        
    };
    

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
                    localStorage.setItem("broyteAppToken", parsedRes.token);   
                    var expiration = new Date();
                    localStorage.setItem("broyteAppTokenExpiration", expiration);   

                    initMapAndFeatureService(parsedRes.token, un);        
                    
                                        
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

    $(document).on("click", "#rodeList a", function (e) {
        var newValueText = $(this).data("text");
        var newValueID = $(this).data("value");
        if (newValueID) {        
            selectedRodeText = newValueText;
            selectedRodeID = newValueID;
            showStep("step3");
            $("#timeInfoText").html("");
            localStorage.setItem("broyteAppLastRodeID", newValueID);    
            $("#choosenRode").html(newValueText);
            showStep("step3");    

            showRodeOnMap(selectedRodeID);
        }
        else {        
            selectedRodeText = null;
            selectedRodeID = null;
        }
        
    });

    $(document).on("click", "#changeRode", function (e) {                    
        showStep("step2");
    });

    $(document).on("click", "#startButton", function () {
        updateFeatureService(selectedRodeID, "SisteStartTidspunkt");
        $("#startButton").hide();
        $("#stopButton").show();        
        
        timestampStart = Date.now();
        var timestampStartReadable = new Date(timestampStart).toLocaleString();
        
        var startText = selectedRodeText + " ble startet brøytet<br/>" + timestampStartReadable;
        $("#timeInfoText").html(startText);
        $("#counter").text("00:00:00");
        incrementSeconds(timestampStart);
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
        var timestampStopReadable = new Date(timestampStop).toLocaleString();
        
        
        var totalTimeReadable = diff_hours(timestampStart, timestampStop);    
        var stopText = selectedRodeText + " ble avsluttet<br/>" + timestampStopReadable + "<br><br>Tid brukt: " + totalTimeReadable;
        $("#timeInfoText").html(stopText);    
        
        var numberOfMs = (timestampStop - timestampStart);
        var numberOfMinutes = Math.floor((numberOfMs/1000)/60);
        if (numberOfMinutes < 5) {
            $("#alertBox #alertText").html("Brøytinger under 5 minutter logges ikke.");
            $("#alertBox").show();
        }
        
    });

    $(document).on("click", "#mapToggleButton", function () {
        $("#showMap").toggle();
        $("#hideMap").toggle();
        $("#map").toggle();
        $("body").height(window.innerHeight - 150);
        
    });


    function showRodeOnMap(rodeId) {
        // Filterer ut de to featureLayersene (line og polygon) som skal filterers og vises i kart
        // "Skedsmo_Brøyteroder_WFL1_6521"
        // "Skedsmo_Brøyteroder_WFL1_9515"
        var layers = window.map.allLayers.filter(function(layer) {
            return layer.id.indexOf("Skedsmo_Brøyteroder") > -1;
        });
        array.forEach(layers.items, function (layer) {            
            layer.definitionExpression = "RodeID='" + rodeId + "'";             
            layer.queryExtent().then(function(results){
                // go to the extent of the results satisfying the query
                if (results && results.extent) {
                    setTimeout(() => {
                        view.goTo(results.extent);    
                    }, 500);
                    
                }            
              });
        });
    }
    

    function diff_hours(startTime, stopTime) 
    {
        var diffInMs = stopTime - startTime;    

        var seconds = diffInMs / 1000;
        var hours = parseInt( seconds / 3600 ); 
        seconds = seconds % 3600; 
        var minutes = parseInt( seconds / 60 ); 
        seconds = Math.floor(seconds % 60);

        if (hours   < 10) {hours   = "0"+hours;}
        if (minutes < 10) {minutes = "0"+minutes;}
        if (seconds < 10) {seconds = "0"+seconds;}
        var outputTime = hours+':'+minutes+':'+seconds;
        return outputTime;        
    }

    function incrementSeconds(startTime) {
        var seconds = 0;

        if (timer) {
        clearInterval(timer);
        }
        
        timer = setInterval(function () {
            var counter = diff_hours(startTime, Date.now())
            $("#counter").text(counter);
            seconds++;
        }, 1000);   
        
    }

    function showStep(id) {
        $("#step1").hide();
        $("#step2").hide();
        $("#step3").hide();
        $("#" + id).show();

        if (id == "step2") {
             // Get unique Rodelist with status
            getRodeList();      
        }

        // 3 = Vis valgt rute med evt Playbutton. Hent opp sist-måkt dato.
        if (id == "step3") {
            $("#startButton").show();
            $("#stopButton").hide();
            getLatestDate(false);
        }
    }

    function updateFeatureService(rodeId, fieldToUpdate) {
        var query = new Query();    
        query.returnGeometry = true;    
        query.outFields = ["*"];        
        query.where = "RodeID=" + rodeId; 
        
        var token = localStorage.getItem("broyteAppToken");
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
                // Når bruker klikker på stopp - vil vi overføre start og stopp tidspunkter til historikktabellen. 
                // Men vi fjerner de ikke fra featureServicen da visualisering i kart bruker tidspunkt-feltene. 
                // Når bruker derimot klikker "start" neste gang blir de overskrevet i featureservicen.
                if (fieldToUpdate == "SisteFerdigTidspunkt") { 
                    layer.applyEdits({updateFeatures: updateFeatures}).then(function(result){             
                        getLatestDate(true);
                    }); 
                }
                else {
                    layer.applyEdits({updateFeatures: updateFeatures});
                }
            });
        })        
    }

    function updateFeatureServiceTable(rodeId, rodeNavn, timestampStart, timestampStop, numberOfMinutes) {          
        if (numberOfMinutes < 5) {
            // do nothing
        }        
        else {
            // Hvis over 600 = 10t 
            if (numberOfMinutes > 600) {
                $("#alertBox #alertText").html("Brøytingen tok over 10 timer. Vi tror du glemte å skru den av, og har derfor satt avsluttet tid til 8 timer.");
                $("#alertBox").show();
                timestampStop = timestampStart;
                timestampStop.setHours(timestampStart.getHours() + 8);
            }
            var token = localStorage.getItem("broyteAppToken");            
            var url = featureServiceUrl + featureServiceTableID + "/applyEdits?token=" + token
            var obj = [
                { 
                    "attributes": {                 
                        RodeID:	rodeId, 
                        RodeNavn: rodeNavn,               
                        SisteStartTidspunkt: timestampStart,
                        SisteFerdigTidspunkt: timestampStop,
                        FaktiskTidsforbrukMin: numberOfMinutes
                    }            
                }
            ];
            var objJson = JSON.stringify(obj);
            if (token) {
                var request = esriRequest(url, { 
                    responseType: 'json',
                    method: 'post',
                    query: {                     
                        adds: objJson,
                        token: token,
                        f: 'json'
                    }
                });

                request.then(function(response) {
                    var test = response;
                });            
            }
        }
        return null;
            // Koden under er enda ikke støttet i ArcGIS JS 4.10. Men vil etterhvert...
            // var addFeatures = [];
            // const addFeature = new Graphic();
            // addFeature.attributes = attr;
            // addFeatures.push(addFeature);            
            // const promise = layer.applyEdits({addFeatures: addFeatures}).then(function(result){             
            //     var test = result;
            // });          
    }
    
});

