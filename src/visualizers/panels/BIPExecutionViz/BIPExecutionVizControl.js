/*globals define, WebGMEGlobal, _*/
/*jshint browser: true*/
/**
 * Visualizer control on top of "BIP" ModelEditorControl that visualizes the simulation trace.
 */

define([
    './../ModelEditor/ModelEditorControl'
], function (ModelEditorControl) {

    'use strict';

    var BIPExecutionVizControl;

    BIPExecutionVizControl = function (options) {

        ModelEditorControl.call(this, options);
    };

    _.extend(BIPExecutionVizControl.prototype, ModelEditorControl.prototype);

    // Methods overridden from ModelEditor
    BIPExecutionVizControl.prototype._onSelectionChanged = function (selectedIds) {
        var gmeIDs = [],
            len = selectedIds.length,
            id;

        while (len--) {
            id = this._ComponentID2GMEID[selectedIds[len]];
            if (id) {
                gmeIDs.push(id);
            }
        }

        WebGMEGlobal.State.registerActiveSelection(gmeIDs, {invoker: this});
    };

    BIPExecutionVizControl.prototype._onDesignerItemDoubleClick = function (id /*, event */) {
        var gmeID = this._ComponentID2GMEID[id],
            node;

        if (gmeID) {
            node = this._client.getNode(gmeID);
            if (node && this.isOfMetaTypeName(node.getMetaTypeId(), 'ComponentType')) {
                WebGMEGlobal.State.registerActiveObject(gmeID, {suppressVisualizerFromNode: true});
            }
        }
    };

    return BIPExecutionVizControl;
});
