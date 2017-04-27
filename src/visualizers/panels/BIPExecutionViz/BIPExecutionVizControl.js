/*globals define, WebGMEGlobal, _, $*/
/*jshint browser: true*/
/**
 * Visualizer control on top of "BIP" ModelEditorControl that visualizes the simulation trace.
 */

define([
    './../ModelEditor/ModelEditorControl',
    'chance',
    'q'
], function (ModelEditorControl, Chance, Q) {

    'use strict';

    var STEP_DELAY = 500;

    function BIPExecutionVizControl(options, parentPanelControl) {

        ModelEditorControl.call(this, options);

        this._instances = {};
        this._chance = new Chance('BIPExecutionVizControl');
        this._stepDelay = STEP_DELAY;

        this._loaded = false;

        this._inStep = false;
        this._pendingActivate = {};

        this._parentPanelControl = parentPanelControl;

        this.designerCanvas.onCheckChanged = this._onFilterCheckChange.bind(this);
    }

    _.extend(BIPExecutionVizControl.prototype, ModelEditorControl.prototype);

    // API used by Container Controller
    BIPExecutionVizControl.prototype.initializeSimulation = function (resultData) {
        var self = this,
            initialStateDecorator,
            initialStateId,
            initialColors = [],
            i,
            cardinality,
            iconEl;

        //this.configureSimulationBtn.enabled(true);
        this._instances = {};

        try {
            // 1. First we initialize the filter and assign a color for each instance.
            cardinality = resultData.info.componentTypes[this.currentNodeInfo.id].cardinality;
            this.designerCanvas.$filterPanel.show();
            this.designerCanvas.$filterUl.empty();
            initialStateId = this._getInitialStateId();

            for (i = 1; i <= cardinality; i += 1) {
                this._instances[i] = {
                    color: this._chance.color({format: 'rgb'}),
                    active: true,
                    stateId: initialStateId,
                    transitionId: null
                };

                iconEl = $('<i/>', {
                    class: 'fa fa-circle instance-filter-item-icon'
                });

                iconEl.css({
                    color: this._instances[i].color
                });

                this.designerCanvas.addFilterItem(i.toString(), i, iconEl);

                iconEl = undefined;

                initialColors.push(this._instances[i].color);
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
            initialColors.forEach(function (color) {
                initialStateDecorator.colorToPathEl[color]
                    .animate({opacity: 1}, 100);
            });
        }

    };

    BIPExecutionVizControl.prototype.stepSimulation = function (stepData, internalStep, back) {
        var deferred = Q.defer(),
            self = this,
            hasMoreSteps = false,
            cnt = 0,
            sources = {},
            destinations = {},
            conns = {},
            transitions;

        this._inStep = true;

        function doTransition(instanceId, src, transition, dst) {
            var srcDecorator = self._getStateDecorator(src),
                dstDecorator = self._getStateDecorator(dst),
                conn = self._getConnection(transition),
                color = self._instances[instanceId].color;

            conn._highlightPath(color, self._stepDelay / 2);
            srcDecorator.colorToPathEl[color]
                .animate({opacity: 0}, self._stepDelay / 2);

            if (sources[src]) {
                sources[src].colors.push(color);
            } else {
                sources[src] = {
                    decorator: srcDecorator,
                    colors: [color]
                }
            }

            if (destinations[dst]) {
                destinations[dst].colors.push(color);
            } else {
                destinations[dst] = {
                    decorator: dstDecorator,
                    colors: [color]
                }
            }

            if (conns[dst]) {
                conns[dst].colors.push(color);
            } else {
                conns[dst] = {
                    decorator: conn,
                    colors: [color]
                }
            }

            cnt += 1;

            setTimeout(function () {
                cnt -= 1;

                if (cnt === 0) {
                    Object.keys(conns).forEach(function (id) {
                        conns[id].decorator._unHighlightPath(color, self._stepDelay / 2);
                    });

                    Object.keys(destinations).forEach(function (id) {
                        var originalColors = destinations[id].decorator.highlightColors,
                            addColors = destinations[id].colors,
                            removeColors = sources[id] ? sources[id].colors : [],
                            colors;

                        colors = _.union(originalColors, addColors);
                        colors = _.difference(colors, removeColors);
                        colors = _.union(colors, _.intersection(addColors, removeColors));

                        destinations[id].decorator.setHighlightColors(colors);
                        colors.forEach(function (color) {
                            var delay = addColors.indexOf(color) > -1 ? (self._stepDelay / 2) : 0;

                            destinations[id].decorator.colorToPathEl[color].animate({opacity: 1}, delay);
                        });
                    });

                    Object.keys(sources).forEach(function (id) {
                        var originalColors = sources[id].decorator.highlightColors,
                            removeColors = sources[id].colors,
                            colors;

                        if (destinations[id]) {
                            // Handled above.
                            return;
                        }

                        colors = _.difference(originalColors, removeColors);
                        sources[id].decorator.setHighlightColors(colors);

                        colors.forEach(function (color) {
                            sources[id].decorator.colorToPathEl[color].css({opacity: 1});
                        });
                    });

                    setTimeout(function () {
                        self._updateActivation();
                        self._inStep = false;
                        deferred.resolve(hasMoreSteps);
                    }, self._stepDelay / 2 + 10);
                }
            }, self._stepDelay / 2 + 10);
        }

        if (stepData[this.currentNodeInfo.id]) {
            transitions = stepData[self.currentNodeInfo.id].transitions;
            Object.keys(transitions).forEach(function (instanceId) {
                var srcState,
                    dstState;

                if (self._instances[instanceId] && transitions[instanceId].length > internalStep) {
                    if (back) {
                        srcState = transitions[instanceId][internalStep].dstState.id;
                        dstState = transitions[instanceId][internalStep].srcState.id;
                        hasMoreSteps = internalStep > 0; // This applies to all..
                    } else {
                        srcState = transitions[instanceId][internalStep].srcState.id;
                        dstState = transitions[instanceId][internalStep].dstState.id;
                        hasMoreSteps = hasMoreSteps || transitions[instanceId].length > (internalStep + 1);
                    }

                    if (self._instances[instanceId].active === true) {
                        doTransition(instanceId, srcState,
                            transitions[instanceId][internalStep].transition.id,
                            dstState);
                    }

                    self._instances[instanceId].stateId = dstState;
                }
            });
        }

        if (cnt === 0) {
            this._inStep = false;
            deferred.resolve(hasMoreSteps);
        }

        return deferred.promise;
    };

    BIPExecutionVizControl.prototype.uiLoaded = function () {
        // Overridden by Container to see that all objects added to canvas.
    };

    BIPExecutionVizControl.prototype.updateSettings = function (settings) {
        this._stepDelay = settings.stepDelay;
    };

    // Helper methods
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

    BIPExecutionVizControl.prototype._onFilterCheckChange = function (id, isChecked) {
        this._pendingActivate[id] = isChecked;

        if (!this._inStep) {
            this._updateActivation();
        }
    };

    BIPExecutionVizControl.prototype._updateActivation = function () {
        var self = this;

        Object.keys(this._pendingActivate).forEach(function (id) {
            var decorator,
                colors;
            if (self._instances[id].active !== self._pendingActivate[id]) {
                self._instances[id].active = self._pendingActivate[id];

                decorator = self._getStateDecorator(self._instances[id].stateId);
                if (self._pendingActivate[id]) {
                    decorator.setHighlightColors(_.union(decorator.highlightColors, [self._instances[id].color]));
                } else {
                    decorator.setHighlightColors(_.difference(decorator.highlightColors, [self._instances[id].color]));
                }

                Object.keys(decorator.colorToPathEl).forEach(function (color) {
                    decorator.colorToPathEl[color].css({opacity: 1});
                });
            }
        });

        this._pendingActivate = {};
    };

    // Methods overridden from ModelEditor
    BIPExecutionVizControl.prototype.selectedObjectChanged = function (nodeId) {
        var self = this,
            node,
            blobHash;

        ModelEditorControl.prototype.selectedObjectChanged.call(this, nodeId);
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
        // var gmeID = this._ComponentID2GMEID[id],
        //     node;
        //
        // if (gmeID) {
        //     node = this._client.getNode(gmeID);
        //     if (node && this.isOfMetaTypeName(node.getMetaTypeId(), 'ComponentType') && this._configured) {
        //         WebGMEGlobal.State.registerActiveObject(gmeID, {suppressVisualizerFromNode: true});
        //     }
        // }
    };

    BIPExecutionVizControl.prototype.processNextInQueue = function () {
        if (this.eventQueue.length === 0 && this._loaded === false) {
            this._loaded = true;
            this.uiLoaded();
        }

        return ModelEditorControl.prototype.processNextInQueue.call(this);
    };

    BIPExecutionVizControl.prototype.onActivate = function () {
        // this._attachClientEventListeners();
        // this._displayToolbarItems();
        // if (this._selectedAspect) {
        //     WebGMEGlobal.State.registerActiveAspect(this._selectedAspect);
        // }
        //
        // if (this.currentNodeInfo && typeof this.currentNodeInfo.id === 'string') {
        //     WebGMEGlobal.State.registerActiveObject(this.currentNodeInfo.id, {suppressVisualizerFromNode: true});
        // }
    };

    return BIPExecutionVizControl;
});
