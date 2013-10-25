/* 
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
    
    
use("conwet.parser");

conwet.parser.ParseUtils = Class.create({
    
    initialize: function() {
    },
    
    /*
     * This function get a DOM object and an element path and returns its value.
     * Is attribute is set, it return that attribute. Otherwise, returns the innerHTML.
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
                    var value = this.getDOMValue(coincidences[x], {Text: subPath, attribute: pathElement.attribute});
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
            return null;
        };

    }
    
});

