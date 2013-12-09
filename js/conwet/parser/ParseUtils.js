/*
 *     Copyright (c) 2013 CoNWeT Lab., Universidad Politécnica de Madrid
 *     Copyright (c) 2013 IGN - Instituto Geográfico general
 *     Centro Nacional de Información Geográfica
 *     http://www.ign.es/
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
    
    
use("conwet.parser");

conwet.parser.ParseUtils = Class.create({
    
    initialize: function() {
    },
    
    /*
     * This function gets a DOM object and an element path and returns its value.
     * Is attribute is set in the config, it returns that attribute. Otherwise, returns the innerHTML.
     * If both attribute and attributeValue are set, it returns the innerHTML of the element with the
     * given attributeValue.
     */              
    getDOMValue: function(DOM, pathElement){
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
                    var value = this.getDOMValue(coincidences[x], {Text: subPath, attribute: pathElement.attribute, attributeValue: pathElement.attributeValue});
                    if(value != null)
                        return value;
                }
                
            }else{
                if(pathElement.attribute != null && pathElement.attributeValue == null)
                    return DOM[pathElement.attribute]; //Just want the value of the attribute
                else if(pathElement.attribute != null && DOM[pathElement.attribute] == pathElement.attributeValue)
                    return DOM.Text; //Coincidence with the value of the attribute
                else if(pathElement.attribute != null) 
                    return null; //No coincidence with the value of the attribute
                else
                    return DOM.Text;   
            }
            
            return null;
            
        }catch(e){
            return null;
        };

    }
    
});

