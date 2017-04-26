/*globals define, WebGMEGlobal, _*/
/*jshint browser: true*/
/**
 * Visualizer control on top of "BIP" ModelEditorControl that visualizes the simulation trace.
 */

define([
    './../ModelEditor/ModelEditorControl',
    'blob/BlobClient',
    'chance',
    'q',
    'text!./SwitchableRoutesEngineOutput.json'
], function (ModelEditorControl, BlobClient, Chance, Q, TEST_DATA) {

    'use strict';

    var RESULT_ATTR = 'engineOutput',
        STEP_DELAY = 1000,
        TEST = true;

    function BIPExecutionVizControl(options) {

        ModelEditorControl.call(this, options);

        this._blobClient = new BlobClient({logger: this.logger.fork('BlobClient')});
        this._resultData = null;
        this._instances = {};
        this._configured = false;
        this._chance = new Chance('BIPExecutionVizControl');

        if (TEST === true) {
            this._resultData = JSON.parse(TEST_DATA);
            this._configured = true;
        }

        this._step = -1;
        this._internalStep = 0;
    }

    _.extend(BIPExecutionVizControl.prototype, ModelEditorControl.prototype);

    BIPExecutionVizControl.prototype._configureSimulation = function () {
        this._configured = true;
        this.configureSimulationBtn.enabled(false);
        alert('Double-click the component-type to visualize');
    };

    BIPExecutionVizControl.prototype._initializeSimulation = function () {
        var self = this,
            initialStateDecorator,
            initialStateId,
            initialColors = [],
            cardinality,
            iconEl;

        //this.configureSimulationBtn.enabled(true);
        this._instances = {};

        try {
            // 1. First we initialize the filter and assign a color for each instance.
            cardinality = this._resultData.info.componentTypes[this.currentNodeInfo.id].cardinality;
            this.designerCanvas.$filterPanel.show();
            this.designerCanvas.$filterUl.empty();
            initialStateId = this._getInitialStateId();

            while (cardinality--) {
                this._instances[cardinality] = {
                    color: this._chance.color({format: 'rgb'}),
                    active: true,
                    stateId: initialStateId,
                    transitionId: null
                };

                iconEl = $('<i/>', {
                    class: 'fa fa-circle instance-filter-item-icon'
                });

                iconEl.css({
                    color: this._instances[cardinality].color
                });

                this.designerCanvas.addFilterItem('Instance ' + cardinality + ' ', cardinality, iconEl);

                iconEl = undefined;

                initialColors.push(this._instances[cardinality].color);
            }

        } catch (err) {
            this._client.notifyUser({
                message: 'Engine output is outdated or wrong format.',
                severity: 'error'
            });

            this.logger.error(err);
            return;
        }

        // 2. We try to obtain the initial state and assign a color highlight for each instance.
        initialStateDecorator = this._getStateDecorator(initialStateId);

        if (typeof initialStateDecorator.setHighlightColors === 'function') {
            initialStateDecorator.setHighlightColors(initialColors);
        }

        this._step = 0;
    };

    BIPExecutionVizControl.prototype._stepSimulation = function (stepData, internalStep) {
        var deferred = Q.defer(),
            self = this,
            hasMoreSteps = false,
            cnt = 0,
            transitions;

        function doTransition(instanceId, src, transition, dst) {
            var srcDecorator = self._getStateDecorator(src),
                dstDecorator = self._getStateDecorator(dst),
                conn = self._getConnection(transition),
                color = self._instances[instanceId].color;

            conn._highlightPath(color, STEP_DELAY / 2);

            cnt += 1;

            setTimeout(function () {
                cnt -= 1;

                srcDecorator.highlightColors.splice(srcDecorator.highlightColors.indexOf(color), 1);
                srcDecorator.updateSvg();

                conn._unHighlightPath(color);
                dstDecorator.highlightColors.push(self._instances[instanceId].color);
                dstDecorator.updateSvg();

                if (cnt === 0) {
                    deferred.resolve(hasMoreSteps);
                }
            }, STEP_DELAY);
        }

        if (stepData[this.currentNodeInfo.id]) {
            transitions = stepData[self.currentNodeInfo.id].transitions;
            Object.keys(transitions).forEach(function (instanceId) {
                if (self._instances[instanceId] &&
                    self._instances[instanceId].active === true &&
                    transitions[instanceId].length > internalStep) {

                    hasMoreSteps = hasMoreSteps || transitions[instanceId].length > (internalStep + 1);

                    doTransition(instanceId,
                        transitions[instanceId][internalStep].srcState.id,
                        transitions[instanceId][internalStep].transition.id,
                        transitions[instanceId][internalStep].dstState.id);
                }
            });
        }

        if (cnt === 0) {
            deferred.resolve(hasMoreSteps);
        }

        return deferred.promise;
    };

    BIPExecutionVizControl.prototype._getInitialStateId = function () {
        var node,
            i;

        // this._GMEID2ComponentID - GME id to component (visual object) id in an array of length 1.
        // this._ComponentID2GMEID - component (visual object) id to GME id
        // this._GMEModels - GME ids of models (whose components are rendered as boxes)
        // this._GMEConnections -  and connection (whose component are rendered as edges)

        // The components (visual objects) are available under this.designerCanvas.items[<componentId>]


        for (i = 0; i < this._GMEModels.length; i += 1) {
            node = this._client.getNode(this._GMEModels[i]);
            if (node && this.isOfMetaTypeName(node.getMetaTypeId(), 'InitialState')) {
                return this._GMEModels[i];
            }
        }
    };

    BIPExecutionVizControl.prototype._getStateDecorator = function (gmeId) {
        var result,
            componentId;


        // this._GMEID2ComponentID - GME id to component (visual object) id in an array of length 1.
        // this._ComponentID2GMEID - component (visual object) id to GME id
        // this._GMEModels - GME ids of models (whose components are rendered as boxes)
        // this._GMEConnections -  and connection (whose component are rendered as edges)

        // The components (visual objects) are available under this.designerCanvas.items[<componentId>]
        componentId = this._GMEID2ComponentID[gmeId] ? this._GMEID2ComponentID[gmeId][0] : null;

        if (componentId && this.designerCanvas.items[componentId]) {
            result = this.designerCanvas.items[componentId]._decoratorInstance;
        }

        return result;
    };

    BIPExecutionVizControl.prototype._getConnection = function (gmeId) {
        var result,
            componentId;


        // this._GMEID2ComponentID - GME id to component (visual object) id in an array of length 1.
        // this._ComponentID2GMEID - component (visual object) id to GME id
        // this._GMEModels - GME ids of models (whose components are rendered as boxes)
        // this._GMEConnections -  and connection (whose component are rendered as edges)

        // The components (visual objects) are available under this.designerCanvas.items[<componentId>]
        componentId = this._GMEID2ComponentID[gmeId] ? this._GMEID2ComponentID[gmeId][0] : null;

        if (componentId && this.designerCanvas.items[componentId]) {
            result = this.designerCanvas.items[componentId];
        }

        return result;
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
                    if (self._step < 0) {
                        self._initializeSimulation();
                    } else {
                        self.startSimulationBtn.enabled(false);
                        Q.all([self._stepSimulation(self._resultData.output[self._step], self._internalStep)])
                            .then(function (res) {
                                self.startSimulationBtn.enabled(true);
                                if (res.indexOf(true) > -1) {
                                    self._internalStep += 1;
                                } else {
                                    self._internalStep = 0;
                                    self._step += 1;
                                }

                                if (self._step >= self._resultData.output.length) {
                                    alert('Simulation ended');
                                    self._step = 0;
                                    self._internalStep = 0;
                                }
                            })
                            .catch(function (err) {
                                self.logger.error('Simulation step failed!', err);
                            });
                    }
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
