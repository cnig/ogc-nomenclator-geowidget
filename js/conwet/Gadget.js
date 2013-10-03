/*
 *     Copyright (c) 2013 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 *     This file is part of the GeoWidgets Project,
 *
 *     http://conwet.fi.upm.es/geowidgets
 *
 *     Licensed under the GNU General Public License, Version 3.0 (the 
 *     "License"); you may not use this file except in compliance with the 
 *     License.
 *
 *     Unless required by applicable law or agreed to in writing, software
 *     under the License is distributed in the hope that it will be useful, 
 *     but on an "AS IS" BASIS, WITHOUT ANY WARRANTY OR CONDITION,
 *     either express or implied; without even the implied warranty of
 *     MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 *  
 *     See the GNU General Public License for specific language governing
 *     permissions and limitations under the License.
 *
 *     <http://www.gnu.org/licenses/gpl.txt>.
 *
 */

use("conwet");

conwet.Gadget = Class.create({

    initialize: function() {
        
        this.locationInfoEvent = new conwet.events.Event('location_info_event');
        this.locationEvent     = new conwet.events.Event('location_event');
        this.outputTextEvent   = new conwet.events.Event('output_text_event');
        this.searchTextEvent   = new conwet.events.Event('search_text_event');

        this.searchTextSlot    = new conwet.events.Slot('search_text_slot', function(text) {
            this.searchInput.value = text;
            this._sendSearchRequest(JSON.parse(this.serviceSelect.getValue()), this.searchInput.value, this.propertySelect.getValue());
        }.bind(this));

        this.serviceConfiguration = null; //Contains the configuration of the service in use
        this.serviceConfigurationList = []; //Contains the configuration of all the services
        
        this.wfsServiceSlot   = new conwet.events.Slot('wfs_service_slot', function(service) {
            service = JSON.parse(service);

            if ((typeof service == 'object') && ('type' in service) && ('url' in service) && ('service_type' in service) && ('name' in service) && (service.type == "WFS") && (service.url != "")) {
                this.addWfsService(service, true);
            }
        }.bind(this));

        this.servicesPreference = MashupPlatform.widget.getVariable("services");
        
        // Attributes
        this.messageManager = new conwet.ui.MessageManager(3000);
        this.transformer    = new conwet.map.ProjectionTransformer();

        this.draw();
    },

    draw: function() {
        var header = $("header");
        conwet.ui.UIUtils.ignoreEvents(header, ["click", "dblclick"]);

        var serviceLabel = document.createElement("div");
        $(serviceLabel).addClassName("label");
        serviceLabel.appendChild(document.createTextNode(_("Servicio WFS:")));
        header.appendChild(serviceLabel);

        //Service selector
        this.serviceSelect = new StyledElements.StyledSelect({"onChange": function(){
                this.setWfsService(JSON.parse(this.serviceSelect.getValue()));
        }});
        this.serviceSelect.addClassName("service");
        this.serviceSelect.textDiv.hide();
        this.serviceSelect.insertInto(header);

        this.serviceSelect.addEntries([{label: _('Select a server'), value: ''}]);

        if (this.servicesPreference.get() != "") {
            var services = JSON.parse(this.servicesPreference.get());

            for (var i=0; i<services.length; i++) {
                this.addWfsService(services[i], i==0);
            }
        }

        var searchLabel = document.createElement("div");
        $(searchLabel).addClassName("label");
        searchLabel.appendChild(document.createTextNode(_("Topónimo:")));
        header.appendChild(searchLabel);

        //Select with the properties that can be used to search in this service
        this.propertySelect = new StyledElements.StyledSelect({"onChange": function(){}});
        this.propertySelect.textDiv.hide();
        //this.propertySelect.addClassName("search"); TEMPORAL!!
        this.propertySelect.addClassName("hidden"); //TEMPORAL!!
        this.propertySelect.addEntries([{label: _('Search by'), value: ''}]);
        this.propertySelect.insertInto(header);
        
        //$(this.propertySelect).hide(); //Temporal
        
        var searchDiv = document.createElement("div");
        $(searchDiv).addClassName("search");
        header.appendChild(searchDiv);
        
        //Text input containing the text to be searched
        this.searchInput = document.createElement("input");
        this.searchInput.type = "text";
        $(this.searchInput).addClassName("search");
        searchDiv.appendChild(this.searchInput);

        var searchButton = conwet.ui.UIUtils.createButton({
            "classNames": ["search_button"],
            "title"     : _("Buscar topónimo"),
            "value"     : _("Buscar"),
            "onClick"   : function(e) {
                this.sendSearch(this.searchInput.value);
                this._sendSearchRequest(JSON.parse(this.serviceSelect.getValue()), this.searchInput.value, this.propertySelect.getValue());
            }.bind(this)
        });
        header.appendChild(searchButton);

    },

    /*
     * This functions adds a WFS service to the select. If added, returns true, othrewise returns false.
     */
    addWfsService: function(service, selected) {
        var serviceJson = JSON.stringify(service);
        
        //Add it if it already isn't in the select
        if(!(serviceJson in this.serviceSelect.optionValues)){
            //Load the configuration of the service
            new Ajax.Request(servicesAssociations[service.url], {
                method: 'GET',
                onSuccess: function(transport) {

                    var configuration = XMLObjectifier.xmlToJSON(transport.responseXML);

                    this.serviceSelect.addEntries([{label: service.name, value: serviceJson}]);
                    
                    //Add the configuration to the list of configurations
                    this.serviceConfigurationList[service.name] = configuration;

                    //Set this as the current service
                    if(selected)
                        this.setWfsService(service);

                    //Tell everything is ok and save the services list (persistent list)
                    this.showMessage(_("Se ha recibido un nuevo servidor."));
                    this.save();
                    
                }.bind(this),
                onFailure: function(transport) {
                    this.showMessage(_("Error al cargar la configuración del servicio"));
                }.bind(this)
            });
        }
        
    },
    
    /*
     * This function changes the current service.
     */
    setWfsService: function(service){
        this.serviceSelect.setValue(JSON.stringify(service));
        
        //Parse the XML configuration to an object
        this.serviceConfiguration = this.serviceConfigurationList[service.name];

        //Set the search options list
        this.propertySelect.clear();
        var searchOptions = this.serviceConfiguration.request[0].search[0].option;
        for(var x = 0; x < searchOptions.length; x++){
            var propertyName = searchOptions[x].Text;
            var label = searchOptions[x].label;
            this.propertySelect.addEntries([{label: _(label), value: propertyName}]);
        }
    },

    /*
     * This function saves the service list
     */
    save: function() {
        var options = this.serviceSelect.optionValues;
        var services = [];
        if(options != null){
            for (var i=0; i<options.length; i++) {
                var service = options[i].getValue();
                if (service != "") {
                    services.push(service);
                }
            }
        }
        this.servicesPreference.set(JSON.stringify(services));
    },

    /*
     * This functions sends an event with the location.
     */
    sendLocation: function(lon, lat) {
        this.locationEvent.send(lon + "," + lat);
    },

    /*
     * This function sends and event with the location info
     */
    sendLocationInfo: function(lon, lat, title) {
        this.locationInfoEvent.send(JSON.stringify({
            "position": {
                "lon": lon,
                "lat": lat
            },
            "title": title
        }));
    },

    sendText: function(text) {
        this.outputTextEvent.send(text);
    },

    sendSearch: function(text) {
        this.searchTextEvent.send(text);
    },

    _sendSearchRequest: function (service, word, property) {
        this.clearUI();

        var baseURL = service.url;

        if ((baseURL == "") || (word == "")) {
            this.showMessage(_("Faltan datos en el formulario."));
            return;
        }

        if (baseURL.indexOf('?') == -1) {
            baseURL = baseURL + '?';
        } else {
            if (baseURL.charAt(baseURL.length - 1) == '&') {
                baseURL = baseURL.slice(0, -1);
            }
        }

        var lowerIndex = 0;
        var upperIndex = 20;

 	//var format = new OpenLayers.Format.CSWGetFeatures();	 
        //var result = format.write(options);
        //var peticion = 'http://www.idee.es/IDEE-WFS-Nomenclator-NGC/services';
        var parameters = {
            "SERVICE": "WFS",
            "VERSION": "1.1.0",
            "REQUEST": "GetFeature",
            "MAXFEATURES": "100",
            "NAMESPACE": this.serviceConfiguration.request[0].namespace[0].Text,
            "TYPENAME": this.serviceConfiguration.request[0].typename[0].Text,
            "FILTER": this.serviceConfiguration.request[0].filter[0].Text.replace("{{word}}", word).replace("{{property}}", property)
        };
        
        //http://www.cartociudad.es/wfs-codigo/services?&SERVICE=WFS&VERSION=1.1.0&REQUEST=GetFeature&MAXFEATURES=100&NAMESPACE=xmlns(app=http://www.deegree.org/app)&TYPENAME=app:Entidad&FILTER=<Filter xmlns:app="http://www.deegree.org/app"><PropertyIsLike wildCard="*" singleChar="?" escapeChar="!"><PropertyName>nombreEntidad_nombre</PropertyName><Literal>*28035*</Literal></PropertyIsLike></Filter>


        this.showMessage("Solicitando datos al servidor.", true);
        //TODO Gif chulo para esperar
        MashupPlatform.http.makeRequest(baseURL, {
            method: 'GET',
            parameters: parameters,
            onSuccess: function(transport) {
                this.hideMessage();
                var xmlObject = XMLObjectifier.xmlToJSON(XMLObjectifier.textToXML(transport.responseText));
                this._drawEntities(xmlObject);
            }.bind(this),
            onFailure: function(){
                this.showError("El servidor no responde.");
            }.bind(this)
        });
    },

    /**
     * This functions shows a list of the results of the search done.
     */
    _drawEntities: function(xmlObject) {
        this.clearUI();
        
        //Get the features typename (without the prefix)
        var configTypename = this.serviceConfiguration.request[0].typename[0].Text;
        var pos = configTypename.indexOf(":");
        var typename;
        if(pos >= 0)
            typename = configTypename.substring(pos+1);
        
        else
            typename = configTypename;
        
        
        
        var entities = xmlObject.featureMember;
        var nEntities = entities.length;
        
        if(nEntities < 1)
            return;
        
        for (var i=0; i<nEntities; i++) {
            var entity = entities[i][typename][0];

            var div = document.createElement("div");
            $(div).addClassName("feature");

            var context = {
                "div"   : div,
                "entity": entity,
                //"url"   : this._decodeASCII(json[1].sourceServiceURL),
                //"type"  : json[1].sourceServiceType,
                "self"  : this
            };

            var showInfo = this.serviceConfiguration.results[0].displayInfo;
            
            div.title = "Send event";
            div.observe("click", function(e) {
                this.self.sendText(this.self._getDOMValue(this.entity, showInfo[0]));
                this.self._showDetails(this.entity);
                //this.self._selectFeature(this.feature, this.div);
            }.bind(context));
            div.observe("mouseover", function(e) {
                this.div.addClassName("highlight");
            }.bind(context), false);
            div.observe("mouseout", function(e) {
                this.div.removeClassName("highlight");
            }.bind(context), false);
            
            //Load the separator character from the service configuration file
            var separator = this.serviceConfiguration.results[0].separator;
            if(separator == null)
                separator = " ";
            
            var span = document.createElement("span");
            
            for(var x = 0; x < showInfo.length; x++){
                
                //Add the separator between fields
                if(span.innerHTML != null)
                    span.innerHTML += separator;
                
                //If a headchar is defined, add it before the field.
                if(showInfo[x].headChar != null)
                    span.innerHTML += showInfo[x].headChar;
                
                //Add the field text
                span.innerHTML += this._getDOMValue(entity, showInfo[x]);
                
                //If a trailChar is defined, add it after the field
                if(showInfo[x].trailChar != null)
                    span.innerHTML += showInfo[x].trailChar;
            }
            div.appendChild(span);

            $("list").appendChild(div);
        }
    },

    _selectFeature: function(feature, element) {
        this._deselectAllFeatures();
        element.addClassName("selected");
        this._showDetails(feature);
    },

    _deselectAllFeatures: function() {
        var features = $("chan_items").childNodes;
        for (var i=0; i<features.length; i++) {
            features[i].removeClassName("selected");
        }
    },

    /*
     * Displays more info about the selected entry in the list of features.
     */
    _showDetails: function(entity) {
        $("info").innerHTML = ""; 
        $("info").appendChild(this._entityToHtml(entity));
        
        var srsConfig = this.serviceConfiguration.results[0].srs[0];
        var srs      = this._getDOMValue(entity, srsConfig);
        var locationConfig = this.serviceConfiguration.results[0].location[0];
        var location = this._getDOMValue(entity, locationConfig).split(" ", 2);
        var locationInfoConfig = this.serviceConfiguration.results[0].locationInfo[0];
        var locationInfo = this._getDOMValue(entity, locationInfoConfig);

        location = new OpenLayers.LonLat(location[0], location[1]);
        if (srs && (srs != "")) {
            location = this.transformer.advancedTransform(location, srs, this.transformer.DEFAULT.projCode);
        }

        //Send the location and location info (location + name)
        this.sendLocation(location.lon, location.lat);
        this.sendLocationInfo(location.lon, location.lat, locationInfo);

    },
    
    /*
     * This functions parses a feature object to an styled HTML
     */
    _entityToHtml: function(entity){
        var html = document.createElement("div");
        html.className = "featureContainer";
        
        this._useDetailsLevels(entity, html, this.serviceConfiguration.details[0]);
        
        return html;
       
    },
            
    /*
     * This function uses the given config (detailslevel) to extract the info
     * from the entity and display it in the parentDiv.
     */
    _useDetailsLevels: function(entity, parentDiv, config){

    var headDiv, fieldsDiv;
                
        var parseInfo = config.detailslevel;
        //Iterate through sections
        for(var x = 0; x < parseInfo.length; x++){
            
            var head = parseInfo[x].label[0].Text;
            
            headDiv = document.createElement("div");
            fieldsDiv = document.createElement("div");
            
            headDiv.className = "featureHead";
            fieldsDiv.className = "featureFieldsContainer";
            
            headDiv.innerHTML = head;
            
            var fieldDiv = document.createElement("div");
            var valueDiv = document.createElement("div");
            valueDiv.className = "fieldValue";
            fieldDiv.className = "fieldContainer";
            
            if(parseInfo[x].path != null){
                valueDiv.innerHTML = this._getDOMValue(entity, parseInfo[x].path[0]);
                fieldsDiv.appendChild(valueDiv);
            }else if(parseInfo[x].detailslevel != null){
                this._useDetailsLevels(entity, fieldsDiv, parseInfo[x]);
            }
            
            parentDiv.appendChild(headDiv);
            parentDiv.appendChild(fieldsDiv);
        }
        
    },
    /*
     * This function get a DOM object and an element path and returns its value.
     * Is attribute is set, it return that attribute. Otherwise, returns the innerHTML.
     */         
    _getDOMValue: function(DOM, pathElement){
        try{
            
            if(pathElement.Text != null && pathElement.Text != ""){
                var path = pathElement.Text.split('/');
                var current = path[0];
                var coincidences = DOM[current];
                
                var subPath;
                if(path.length <= 1)
                    subPath = "";
                else{
                    subPath = pathElement.Text.substring(pathElement.Text.indexOf("/")+1);
                }
                
                for(var x = 0; x < coincidences.length; x++){
                    var value = this._getDOMValue(coincidences[x], {Text: subPath, attribute: pathElement.attribute});
                    if(value != null)
                        return value;
                }
                
            }else{
                if(pathElement.attribute != null)
                    return DOM[pathElement.attribute];
                else
                    return DOM.Text;   
            }
            
            return null;
            
        }catch(e){
            return null
        };

    },

    _clearDetails: function() {
        $("info").innerHTML = "";
    },

    clearUI: function() {
        this._clearDetails();
        $("list").innerHTML = "";
    },

    showMessage: function(message, permanent) {
        this.messageManager.showMessage(message, conwet.ui.MessageManager.INFO, permanent);
    },

    hideMessage: function() {
        this.messageManager.hideMessage();
    },

    showError: function(message, permanent) {
        this.messageManager.showMessage(message, conwet.ui.MessageManager.ERROR, permanent);
    }

});
