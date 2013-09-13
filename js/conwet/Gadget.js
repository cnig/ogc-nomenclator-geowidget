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
        // EzWeb variables
        this.locationInfoEvent = new conwet.events.Event('location_info_event');
        this.locationEvent     = new conwet.events.Event('location_event');
        this.outputTextEvent   = new conwet.events.Event('output_text_event');
        this.searchTextEvent   = new conwet.events.Event('search_text_event');

        this.searchTextSlot    = new conwet.events.Slot('search_text_slot', function(text) {
            this.searchInput.value = text;
            this._sendSearchRequest(this.serviceSelect.getValue(), this.searchInput.value);
        }.bind(this));

        this.wfsServiceSlot   = new conwet.events.Slot('wfs_service_slot', function(service) {
            service = JSON.parse(service);
            if (typeof service == 'object') {
                if (('type' in service) && ('url' in service) && ('service_type' in service) && ('name' in service) && (service.type == "WFS") && (service.url != "")) {
                    this.addWfsService(service, true);
                    this.showMessage(_("Se ha recibido un nuevo servidor."));
                    this.save();
                }
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

        this.serviceSelect = new StyledElements.StyledSelect({"onChange": function(){}});
        this.serviceSelect.addClassName("service");
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

        var searchDiv = document.createElement("div");
        $(searchDiv).addClassName("search");
        header.appendChild(searchDiv);

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
                this._sendSearchRequest(this.serviceSelect.getValue(), this.searchInput.value);
            }.bind(this)
        });
        header.appendChild(searchButton);

    },

    addWfsService: function(service, selected) {
        this.serviceSelect.addEntries([{label: service.name, value: service, selected: selected}]);
    },

    save: function() {
        var options = this.serviceSelect.options;
        var services = [];
        for (var i=0; i<options.length; i++) {
            var service = options[i].getValue();
            if (service != "") {
                services.push(service);
            }
        }
        this.servicesPreference.set(JSON.stringify(services));
    },

    sendLocation: function(lon, lat) {
        this.locationEvent.send(lon + "," + lat);
    },

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

    _sendSearchRequest: function (service, word) {
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
        var peticion = 'http://www.idee.es/IDEE-WFS-Nomenclator-NGC/services';
        var parameters = {
            "SERVICE": "WFS",
            "VERSION": "1.1.0",
            "REQUEST": "GetFeature",
            "MAXFEATURES": "100",
            "NAMESPACE": "xmlns(mne=http://www.idee.es/mne)",
            "TYPENAME": "mne:Entidad",
            "FILTER": '<Filter xmlns:mne="http://www.idee.es/mne"><PropertyIsLike wildCard="*" singleChar="?" escapeChar="!"><PropertyName>mne:nombreEntidad/mne:NombreEntidad/mne:nombre</PropertyName><Literal>*'+word+'*</Literal></PropertyIsLike></Filter>'
        };
        //&sourceTitle=Nomenclux00E1torux0020EuroGeonames

        this.showMessage("Solicitando datos al servidor.", true);
        //TODO Gif chulo para esperar
        MashupPlatform.http.makeRequest(peticion, {
            method: 'GET',
            parameters: parameters,
            onSuccess: function(transport) {
                this.hideMessage();
                //var obj = format.read(transport.responseText); //DEBUG
                var oParser = new DOMParser();
                var oDOM = oParser.parseFromString(transport.responseText, "text/xml");
                //this._drawEntities(eval(transport.responseText), lowerIndex , upperIndex);
                this._drawEntities(oDOM, lowerIndex , upperIndex);
            }.bind(this),
            onFailure: function(){
                this.showError("El servidor no responde.");
            }.bind(this)
        });
    },

    _drawEntities: function(oDOM, lowerIndex , upperIndex) {
        this.clearUI();

        var nEntities = oDOM.documentElement.getAttribute("numberOfFeatures");
        
        if(nEntities < 2)
            return;
        
        var entities = oDOM.documentElement.children;

        for (var i=1; i<nEntities; i++) {
            var entity = entities[i];

            var div = document.createElement("div");
            $(div).addClassName("feature");

            var context = {
                "div"   : div,
                "entity": entity,
                //"url"   : this._decodeASCII(json[1].sourceServiceURL),
                //"type"  : json[1].sourceServiceType,
                "self"  : this
            };

            div.title = "Send event";
            div.observe("click", function(e) {
                this.self.sendText(this.entity.getElementsByTagName("mne:nombreEntidad")[0].getElementsByTagName("mne:nombre")[0].innerHTML);
                this.self._showDetails(this.entity);
                //this.self._selectFeature(this.feature, this.div);
            }.bind(context));
            div.observe("mouseover", function(e) {
                this.div.addClassName("highlight");
            }.bind(context), false);
            div.observe("mouseout", function(e) {
                this.div.removeClassName("highlight");
            }.bind(context), false);

            var title = document.createElement("span");
            $(title).addClassName("title");
            title.innerHTML = entity.getElementsByTagName("mne:nombreEntidad")[0].getElementsByTagName("mne:nombre")[0].innerHTML;
            div.appendChild(title);

            var type = document.createElement("span");
            $(type).addClassName("type");
            type.innerHTML = " (" +entity.getElementsByTagName("mne:nombreEntidad")[0].getElementsByTagName("mne:tipo")[0].innerHTML + ")";
            div.appendChild(type);

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

    _showDetails: function(entity) {
        $("info").innerHTML = "einggg??"; //this._decodeASCII(json[1].metadataHTML);

        var srs      = entity.getElementsByTagName("mne:posicionEspacial")[0].getElementsByTagName("gml:Point")[0].getAttribute("srsName");
        var location = entity.getElementsByTagName("mne:posicionEspacial")[0].getElementsByTagName("gml:Point")[0].getElementsByTagName("gml:pos")[0].innerHTML.split(" ", 2);
        if (!location || (location == "")) {
            var sections = $("info").getElementsByClassName("section5v");
            if (sections.length > 0) {
                location = $("info").getElementsByClassName("section5v")[0].innerHTML.split(" ", 2);
            }
        }

        location = new OpenLayers.LonLat(location[0], location[1]);
        if (srs && (srs != "")) {
            location = this.transformer.advancedTransform(location, srs, this.transformer.DEFAULT.projCode);
        }

        this.sendLocation(location.lon, location.lat);
        this.sendLocationInfo(location.lon, location.lat, entity.getElementsByTagName("mne:nombreEntidad")[0].getElementsByTagName("mne:nombre")[0].innerHTML);

        var sections = $("info").getElementsByClassName("section3v");
        for (var i=0; i<sections.length; i++) {
            $(sections[i]).observe("click", function(e) {
                e.target.title = "Send event";
                this.sendText(e.target.innerHTML);
            }.bind(this));
        }

        sections = $("info").getElementsByClassName("section5v");
        for (var i=0; i<sections.length; i++) {
            $(sections[i]).observe("click", function(e) {
                e.target.title = "Send event";
                this.sendText(e.target.innerHTML);
            }.bind(this));
        }
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
