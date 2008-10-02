/* * TODO interaction format step through <=> oryx should be json!!! *//** * Copyright (c) 2008, Christoph Neijenhuis * * Permission is hereby granted, free of charge, to any person obtaining a * copy of this software and associated documentation files (the "Software"), * to deal in the Software without restriction, including without limitation * the rights to use, copy, modify, merge, publish, distribute, sublicense, * and/or sell copies of the Software, and to permit persons to whom the * Software is furnished to do so, subject to the following conditions: * * The above copyright notice and this permission notice shall be included in * all copies or substantial portions of the Software. * * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER * DEALINGS IN THE SOFTWARE. **/if (!ORYX.Plugins)     ORYX.Plugins = new Object();ORYX.Plugins.StepThroughPlugin = Clazz.extend({	        construct: function(facade){            this.facade = facade;                this.active = false;        this.el = undefined;        this.callback = undefined;        this.executionTrace = ""; // A string containing all objects that have been fired        this.rdf = undefined;        this.errors = "";                this.facade.offer({            'name': ORYX.I18N.StepThroughPlugin.stepThrough,            'functionality': this.load.bind(this),            'group': ORYX.I18N.StepThroughPlugin.group,            'icon': ORYX.PATH + "images/control_play.png",            'description': ORYX.I18N.StepThroughPlugin.stepThroughDesc,            'index': 1,            'minShape': 0,            'maxShape': 0        });                this.facade.offer({            'name': ORYX.I18N.StepThroughPlugin.undo,            'functionality': this.undo.bind(this),            'group': ORYX.I18N.StepThroughPlugin.group,            'icon': ORYX.PATH + "images/control_rewind.png",            'description': ORYX.I18N.StepThroughPlugin.undoDesc,            'index': 2,            'minShape': 0,            'maxShape': 0        });    },        load: function(){        // Called when the user loads or unloads the plugin        if (this.active) {            // Reset vars            this.executionTrace = "";            this.rdf = undefined;            this.errors = "";                        // Hide overlays            this.hideOverlays();        }        else {            this.startAndCheckSyntax();                        if (this.errors != "") {                // Show errors                this.showErrors(this.errors);                                // Display a message so the user knows what is going on                Ext.Msg.alert("Oryx", ORYX.I18N.StepThroughPlugin.error);                                // Stop further execution                this.active = !this.active;                return;            }        }                this.active = !this.active;                if (this.active) {            this.callback = this.doMouseUp.bind(this)            this.facade.registerOnEvent("mouseup", this.callback)                    }        else {            this.facade.unregisterOnEvent("mouseup", this.callback)            this.callback = undefined;        }    },        hideOverlays: function(){        // hides all overlays        var els = this.facade.getCanvas().getChildShapes(true);        var el;        for (i = 0; i < els.size(); i++) {            el = els[i];            // This may send hide-events for objects that have no overlay            this.facade.raiseEvent({                type: "overlay.hide",                id: "st." + el.resourceId            });        }    },    	/* TODO this should be a general oryx helper method!! */    generateRDF: function(){        // Force to set all resource IDs        var serializedDOM = DataManager.serializeDOM(this.facade);                //get current DOM content        var serializedDOM = DataManager.__persistDOM(this.facade);        //add namespaces        serializedDOM = '<?xml version="1.0" encoding="utf-8"?>' +        '<html xmlns="http://www.w3.org/1999/xhtml" ' +        'xmlns:b3mn="http://b3mn.org/2007/b3mn" ' +        'xmlns:ext="http://b3mn.org/2007/ext" ' +        'xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" ' +        'xmlns:atom="http://b3mn.org/2007/atom+xhtml">' +        '<head profile="http://purl.org/NET/erdf/profile">' +        '<link rel="schema.dc" href="http://purl.org/dc/elements/1.1/" />' +        '<link rel="schema.dcTerms" href="http://purl.org/dc/terms/ " />' +        '<link rel="schema.b3mn" href="http://b3mn.org" />' +        '<link rel="schema.oryx" href="http://oryx-editor.org/" />' +        '<link rel="schema.raziel" href="http://raziel.org/" />' +        '<base href="' +        location.href.split("?")[0] +        '" />' +        '</head><body>' +        serializedDOM +        '</body></html>';                //convert to RDF        var parser = new DOMParser();        var parsedDOM = parser.parseFromString(serializedDOM, "text/xml");        var xsltPath = ORYX.PATH + "lib/extract-rdf.xsl";        var xsltProcessor = new XSLTProcessor();        var xslRef = document.implementation.createDocument("", "", null);        xslRef.async = false;        xslRef.load(xsltPath);        xsltProcessor.importStylesheet(xslRef);        try {            var new_rdf = xsltProcessor.transformToDocument(parsedDOM);            var serialized_rdf = (new XMLSerializer()).serializeToString(new_rdf);                        // Firefox 2 to 3 problem?!            serialized_rdf = !serialized_rdf.startsWith("<?xml") ? "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" + serialized_rdf : serialized_rdf;        }         catch (error) {            this.facade.raiseEvent({                type: 'loading.disable'            });            Ext.Msg.alert("Oryx (rdf)", error);        }                this.rdf = serialized_rdf;    },        getRDF: function(){        if (this.rdf == undefined) {            this.generateRDF();        }                return this.rdf;    },        startAndCheckSyntax: function(){        this.postExecutionTrace({            checkSyntax: true,            onlyChangedObjects: false,            onSuccess: function(request){                if (request.responseText.startsWith("!errors!")) {                    this.errors = request.responseText.substring(8);                }                else {                    this.showObjectStates(request.responseText);                }            }.bind(this)        });    },        fireObject: function(objResourceId){        // Add this object to executionTrace        this.executionTrace += objResourceId + ";";                // Add selected edges for or split        if (this.isOrSplit(this.el)) {            //eliminate ;            this.executionTrace = this.executionTrace.substring(0, this.executionTrace.length - 1);            this.executionTrace += "#";            var outgoingEdges = new Ext.util.MixedCollection();            outgoingEdges.addAll(this.el.getOutgoingShapes());            var firingEdgesResourceIds = [];            outgoingEdges.filter("selectedForOrSplit", "true").each(function(edge){                firingEdgesResourceIds.push(edge.resourceId);            }.createDelegate(this));            outgoingEdges.each(function(edge){                edge.selectedForOrSplit = false;                this.hideOverlayOnShape(edge);            }.createDelegate(this));            this.executionTrace += firingEdgesResourceIds.join(",") + ";";        }                this.postExecutionTrace({            checkSyntax: false,            onlyChangedObjects: true,            onSuccess: function(request){                if (request.responseText != "") {                    // successful                    this.showObjectStates(request.responseText);                }                else {                    // object couldn't be fired, remove it from executionTrace                    this.removeLastFiredObject();                }            }.bind(this)        });    },        onSelectionChanged: function(){        if (this.active && this.facade.getSelection().length > 0) {            if (this.errors == "") {                // Stop the user from editing the diagram while the plugin is active                this.facade.setSelection([]);            }        }    },        doMouseUp: function(event, arg){        if (arg instanceof ORYX.Core.Shape) {            if (arg instanceof ORYX.Core.Edge && this.isOrSplit(arg.getIncomingShapes()[0])) {                this.doMouseUpOnEdgeComingFromOrSplit(arg);            }            else {                this.el = arg;                this.fireObject(this.el.resourceId);            }        }    },        showObjectStates: function(objs){        var objsAndState = objs.split(";");        for (i = 0; i < objsAndState.size(); i++) {            var objAndState = objsAndState[i].split(",");            if (objAndState.size() < 3) {                continue;            }            var obj = this.facade.getCanvas().getChildShapeByResourceId(objAndState[0]);            if (objAndState[2] == "t") { // Is enabled                this.showEnabled(obj, objAndState[1]);            }            else if (objAndState[1] != "0") { // has been used                this.showUsed(obj, objAndState[1]);            }            else { // Was enabled, has not been used                this.facade.raiseEvent({                    type: "overlay.hide",                    id: "st." + objAndState[0]                });            }        }    },        showEnabled: function(shape, display){        // Creates overlay for an enabled shape        // display is beeing ignored        if (!(shape instanceof ORYX.Core.Shape)) {            return;        }        else if (this.isOrSplit(shape)) { //special handling for OR-Split            this.showEnabledOrSplit(shape);            return;        }                this.showPlayOnShape(shape);    },        showPlayOnShape: function(shape){        var attr;        if (shape instanceof ORYX.Core.Edge) {            attr = {                stroke: "green"            };        }        else {            attr = {                fill: "green",                stroke: "black",                "stroke-width": 2            };        }                var play = ORYX.Editor.graft("http://www.w3.org/2000/svg", null, ['path', {            "title": "Click the element to execute it!",            "stroke-width": 2.0,            "stroke": "black",            "d": "M0,-5 L5,0 L0,5 Z",            "line-captions": "round"        }]);                this.showOverlayOnShape(shape, attr, play);    },        showOverlayOnShape: function(shape, attributes, node){        this.hideOverlayOnShape(shape);                this.facade.raiseEvent({            type: "overlay.show",            id: "st." + shape.resourceId,            shapes: [shape],            attributes: attributes,            node: (node ? node : null),            nodePosition: shape instanceof ORYX.Core.Edge ? "END" : "SE"        });    },        hideOverlayOnShape: function(shape){        this.facade.raiseEvent({            type: "overlay.hide",            id: "st." + shape.resourceId        });    },        doMouseUpOnEdgeComingFromOrSplit: function(edge){        var orSplit = edge.getIncomingShapes()[0];                if (edge.selectedForOrSplit) { //deselect edge            this.showOverlayOnShape(edge, {                stroke: "orange"            });                        // Hide or-split overlay, if last edge has been deselected            var outgoingEdges = new Ext.util.MixedCollection();            outgoingEdges.addAll(orSplit.getOutgoingShapes());            if (outgoingEdges.filter("selectedForOrSplit", "true").length <= 1) { // > 1, because current edge is in this list                this.hideOverlayOnShape(orSplit);            }                    }        else { //select edge            this.showOverlayOnShape(edge, {                stroke: "green"            });            this.showPlayOnShape(orSplit);        }                // toggle selection        edge.selectedForOrSplit = !edge.selectedForOrSplit;    },        //checks whether shape is OR gateway and hasn't more than 1 outgoing edges    isOrSplit: function(shape){        return (shape.getStencil().id().search(/#OR_Gateway$/) > -1) && (shape.getOutgoingShapes().length > 1);    },        showEnabledOrSplit: function(shape){        Ext.each(shape.getOutgoingShapes(), function(edge){            Ext.apply(edge, {                selectedForOrSplit: false            });                        this.showOverlayOnShape(edge, {                stroke: "orange"            });        }.createDelegate(this));    },        showUsed: function(shape, display){        // Creates overlay for a shape that has been used and is not enabled        if (!(shape instanceof ORYX.Core.Shape))             return;                var attr;        if (shape instanceof ORYX.Core.Edge) {            attr = {                stroke: "mediumslateblue"            };        }        else {            attr = {                fill: "mediumslateblue",                stroke: "black",                "stroke-width": 2            };        }                this.facade.raiseEvent({            type: "overlay.hide",            id: "st." + shape.resourceId        });                if (display != "-1") {            // Show the number            var text = ORYX.Editor.graft("http://www.w3.org/2000/svg", null, ['text', {                "style": "font-size: 16px; font-weight: bold;"            }, display]);                        this.facade.raiseEvent({                type: "overlay.show",                id: "st." + shape.resourceId,                shapes: [shape],                attributes: attr,                node: text,                nodePosition: shape instanceof ORYX.Core.Edge ? "END" : "SE"            });        }        else {            // This is an XOR split, don't display number            this.facade.raiseEvent({                type: "overlay.show",                id: "st." + shape.resourceId,                shapes: [shape],                attributes: attr            });        }    },        showErrors: function(errorstring){        // When the syntax check goes wrong, the errors including explanation are shown        var errors = errorstring.split(";");        for (i = 0; i < errors.size(); i++) {            var error = errors[i].split(":");            if (error.size() < 2) {                continue;            }            var obj = this.facade.getCanvas().getChildShapeByResourceId(error[0]);                        var cross = ORYX.Editor.graft("http://www.w3.org/2000/svg", null, ['path', {                "title": error[1],                "stroke-width": 5.0,                "stroke": "red",                "d": "M20,-5 L5,-20 M5,-5 L20,-20",                "line-captions": "round"            }]);                        this.facade.raiseEvent({                type: "overlay.show",                id: "st." + obj.resourceId,                shapes: [obj],                node: cross,                nodePosition: obj instanceof ORYX.Core.Edge ? "START" : "NW"            });        }    },        removeLastFiredObject: function(){        // Removes last entry in execution trace        this.executionTrace = this.executionTrace.replace(/[^;]*;$/, "")    },        undo: function(){        if (!this.active)             return;                this.removeLastFiredObject();                this.postExecutionTrace({            checkSyntax: false,            onlyChangedObjects: false,            onSuccess: function(request){                // Hide overlays because everything is drawn from scratch                this.hideOverlays();                // Draw new overlays                this.showObjectStates(request.responseText);            }.bind(this)        });    },        /* Posts current execution trace to server for executing      * options is a hash with following keys:     * - onlyChangedObjects (boolean)     * - onSuccess (function with parameter request)     * - checkSyntax (boolean)     */    postExecutionTrace: function(options){        //TODO merge in default options        new Ajax.Request(ORYX.CONFIG.STEP_THROUGH, {            method: 'POST',            asynchronous: false,            parameters: {                rdf: this.getRDF(),                checkSyntax: options.checkSyntax,                fire: this.executionTrace,                onlyChangedObjects: options.onlyChangedObjects            },            onSuccess: options.onSuccess        });    }});