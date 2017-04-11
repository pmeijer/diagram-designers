/*globals define, WebGMEGlobal, _*/
/*jshint browser: true*/
/**
 * Visualizer control on top of "BIP" ModelEditorControl that visualizes the simulation trace.
 */

define([
    './../ModelEditor/ModelEditorControl',
    'blob/BlobClient',
    'chance'
], function (ModelEditorControl, BlobClient, Chance) {

    'use strict';

    var RESULT_ATTR = 'engineOutput';

    function BIPExecutionVizControl(options) {

        ModelEditorControl.call(this, options);

        this._blobClient = new BlobClient({logger: this.logger.fork('BlobClient')});
        this._resultData = null;
        this._configured = false;
        this._chance = new Chance('BIPExecutionVizControl');
    }

    _.extend(BIPExecutionVizControl.prototype, ModelEditorControl.prototype);

    BIPExecutionVizControl.prototype._configureSimulation = function () {
        this._configured = true;
        this.configureSimulationBtn.enabled(false);
        alert('Double-click the component-type to visualize');
    };

    BIPExecutionVizControl.prototype._startSimulation = function () {
        var cardinality,
            iconEl;

        this._configured = true;
        this.configureSimulationBtn.enabled(false);

        try {

            cardinality = this._resultData.info.componentTypes[this.currentNodeInfo.id].cardinality;
            this._resultData.info.componentTypes[this.currentNodeInfo.id].instances = {};
            this.designerCanvas.$filterPanel.show();
            this.designerCanvas.$filterUl.empty();

            while (cardinality--) {
                this._resultData.info.componentTypes[this.currentNodeInfo.id].instances[cardinality] = {
                    color: this._chance.color({format: 'hex'})
                };

                iconEl = $('<i/>', {
                    class: 'instance-filter-item'
                });

                iconEl.css({
                    color: this._resultData.info.componentTypes[this.currentNodeInfo.id].instances[cardinality]
                });

                this.designerCanvas.addFilterItem('Instance ' + cardinality, cardinality, iconEl);

                iconEl = undefined;
            }

        } catch (err) {
            this._client.notifyUser({
                message: 'Engine output is outdated or wrong format.',
                severity: 'error'
            });
            this.logger.error(err);
        }
    };

    // Methods overridden from ModelEditor
    BIPExecutionVizControl.prototype.selectedObjectChanged = function (nodeId) {
        var self = this,
            node,
            blobHash;
        ModelEditorControl.prototype.selectedObjectChanged.call(this, nodeId);

        node = this._client.getNode(nodeId);

        if (this._configured) {
            if (node && this.isOfMetaTypeName(node.getMetaTypeId(), 'ComponentType')) {
                this.startSimulationBtn.enabled(true);
                alert('Start the simulation using the toolbar.');
            }
            return;
        }


        this._resultData = null;
        this.designerCanvas.showProgressbar();
        this.configureSimulationBtn.enabled(false);

        blobHash = node ? node.getAttribute(RESULT_ATTR) : null;

        if (blobHash) {
            this._blobClient.getObjectAsJSON(blobHash)
                .then(function (resultData) {
                    self._resultData = resultData;
                    self._client.notifyUser({
                        message: 'Current Project has attached results! To start result simulation use tool-bar.',
                        severity: 'success'
                    });
                    self.designerCanvas.hideProgressbar();
                    self.configureSimulationBtn.enabled(true);
                })
                .catch(function (err) {
                    self._client.notifyUser({
                        message: 'Failed obtaining engineOutput from Project.',
                        severity: 'error'
                    });
                    self.logger(err);
                    self.designerCanvas.hideProgressbar();
                });

        } else {
            this.designerCanvas.hideProgressbar();
        }
    };

    BIPExecutionVizControl.prototype._initializeToolbar = function () {
        var toolBar = WebGMEGlobal.Toolbar,
            self = this;

        this._toolbarItems = [];

        // Configure btn
        this.configureSimulationBtn = toolBar.addButton(
            {
                title: 'Configure simulation',
                icon: 'fa fa-cogs',
                clickFn: function (/*data*/) {
                    self._configureSimulation();
                }
            });

        this._toolbarItems.push(this.configureSimulationBtn);
        this.configureSimulationBtn.enabled(false);

        // Start btn
        this.startSimulationBtn = toolBar.addButton(
            {
                title: 'Start simulation',
                icon: 'fa fa-film',
                clickFn: function (/*data*/) {
                    self._startSimulation();
                }
            });

        this._toolbarItems.push(this.startSimulationBtn);
        this.startSimulationBtn.enabled(false);

        this._toolbarInitialized = true;
    };

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
            if (node && this.isOfMetaTypeName(node.getMetaTypeId(), 'ComponentType') && this._configured) {
                WebGMEGlobal.State.registerActiveObject(gmeID, {suppressVisualizerFromNode: true});
            }
        }
    };

    return BIPExecutionVizControl;
});
