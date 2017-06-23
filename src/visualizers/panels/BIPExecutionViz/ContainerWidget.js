/*globals define, $*/
/*jshint browser: true*/

/**
 * Generated by VisualizerGenerator 1.7.0 from webgme on Wed Apr 26 2017 17:14:44 GMT-0500 (Central Daylight Time).
 */

define([
    'js/Loader/LoaderCircles',
    'js/Controls/PropertyGrid/Widgets/IntegerWidget',
    'css!./styles/ContainerWidget.css'
], function (LoaderCircles, IntegerWidget) {
    'use strict';

    var ContainerWidget,
        MAX_NUMBER_OF_PANELS = 4,
        WIDGET_CLASS = 'bip-execution-container-widget';

    ContainerWidget = function (logger, container) {
        this._logger = logger.fork('Widget');

        this._el = container;
        this._panels = {};
        this._nbrOfPanels = null;
        this._components = null;

        this._initialize();

        this._logger.debug('ctor finished');
    };

    ContainerWidget.prototype._initialize = function () {
        // set widget class
        this._el.addClass(WIDGET_CLASS);
        this._loader = new LoaderCircles({containerElement: this._el});

        // Add configuration elements
        this._configContainer = $('<div class="configuration-form">' +
            '<div class="configuration-title">Number of Panels</div>' +
            '<div class="configuration-desc">Select the number of panels you would like to allocate ' +
            'for each Component Type. Note that each panel can visualize multiple instances.' +
            '</div>' +
            '</div>');

        this._configForm = $('<form class="form-horizontal" role="form"></form>');
        this._configContainer.append(this._configForm);

        this._el.append(this._configContainer);
        this._configContainer.hide();

        // Add simulation panel elements
        this._panelsContainer = $('<div class="panels-container">');
        this._el.append(this._panelsContainer);

        this._panelsContainer.hide();
    };

    ContainerWidget.prototype.onWidgetContainerResize = function (width, height) {
        var self = this;

        this._el.width(width);
        this._el.height(height);

        Object.keys(this._panels).forEach(function (key) {
            var left = 0,
                top = 0,
                w,
                h;

            switch (self._nbrOfPanels) {
                case 1:
                    w = width;
                    h = height;
                    break;
                case 2:
                    w = width / 2;
                    h = height;
                    left = key === '2' ? w : 0;
                    break;
                case 3:
                    h = height / 2;
                    if (key === '1') {
                        w = width / 2;
                    } else if (key === '2') {
                        w = width / 2;
                        left = w;
                    } else { // === '3'
                        top = h;
                        w = width;
                    }
                    break;
                case 4:
                    h = height / 2;
                    w = width / 2;
                    if (key === '2') {
                        left = w;
                    } else if (key === '3') {
                        top = h;
                    } else if (key === '4') {
                        top = h;
                        left = w;
                    }
                    break;
                default:
                    throw new Error('Unexpected panel count!');
            }

            self._panels[key].el.css({
                top: top,
                left: left,
                width: w,
                height: h
            });

            self._panels[key].panel.setSize(w, h);
        });
    };

    // Adding/Removing/Updating items
    ContainerWidget.prototype.addInnerPanel = function (panel) {
        var containerEl = $('<div class="panel-container">');

        this._panels[(Object.keys(this._panels).length + 1).toString()] = {
            panel: panel,
            el: containerEl
        };

        containerEl.append(panel.$pEl);

        this._panelsContainer.append(containerEl);

        if (Object.keys(this._panels).length === this._nbrOfPanels) {
            // When all are added - resize the container.
            this.onWidgetContainerResize(this._el.width(), this._el.height());
        }
    };

    ContainerWidget.prototype._addPanelContainers = function (nodeIds) {
        var self = this;
        this._nbrOfPanels = nodeIds.length;

        self.setTitle('');
        self._el.addClass('simulation-mode');

        this._panelsContainer.show();
    };

    ContainerWidget.prototype.populateConfigure = function (componentTypes, callback) {
        var self = this,
            widgets = [],
            okBtn,
            settings,
            sWidget,
            selectHighest;

        selectHighest = componentTypes
                .map(function (cInfo) {
                    return cInfo.cardinality;
                })
                .reduce(function (sum, card) {
                    return sum + card;
                }, 0) <= MAX_NUMBER_OF_PANELS;

        function getSelectedIds() {
            var nodeIds = [],
                j,
                i;

            // Account for the settings widget.
            for (i = 0; i < widgets.length; i += 1) {
                for (j = 0; j < widgets[i].getValue(); j += 1) {
                    nodeIds.push(widgets[i].propertyID);
                }
            }

            return nodeIds;
        }

        function onChange(/*value*/) {
            var nodeIds = getSelectedIds(),
                ok = true;

            if (nodeIds.length === 0) {
                ok = false;
            } else if (nodeIds.length > MAX_NUMBER_OF_PANELS) {
                ok = false;
                self.notifyUser({
                    severity: 'warning',
                    message: 'Currently no more than ' + MAX_NUMBER_OF_PANELS + ' panels supported.'
                });
            }

            okBtn.disable(!ok);
        }

        componentTypes.forEach(function (cInfo) {
            var entry = $('<div class="form-group">'),
                widget = new IntegerWidget({
                    value: selectHighest ? cInfo.cardinality : 0,
                    minValue: 0,
                    maxValue: cInfo.cardinality,
                    name: cInfo.name,
                    id: cInfo.id
                });

            widget.onFinishChange(onChange);
            widgets.push(widget);

            entry.append($('<div class="col-sm-6 control-label">')
                .text(cInfo.name + ' (' + cInfo.cardinality + ')')
                .attr('title', 'There are ' + cInfo.cardinality + ' ' + cInfo.name + '(s)' + ' from path [' +
                    cInfo.id + '].'
                ));

            entry.append($('<div class="col-sm-6 controls">').append(widget.el));

            self._configForm.append(entry);
        });

        self._configForm.append($('<div class="configuration-title">Settings</div>'));
        settings = $('<div class="form-group">');
        settings.append($('<div class="col-sm-6 control-label">').text('Step Animation Time [ms]'));

        sWidget = new IntegerWidget({
            value: 1000,
            minValue: 0,
            name: 'stepTime',
            id: 'stepTime'
        });

        settings.append($('<div class="col-sm-6 controls">').append(sWidget.el));

        self._configForm.append(settings);
        self._configForm.append(settings);

        okBtn = $('<a href="#" class="btn btn-sm btn-primary btn-config">OK</button>');

        okBtn.disable(!selectHighest);

        okBtn.on('click', function () {
            var nodeIds = getSelectedIds(),
                delay = sWidget.getValue();

            self._components = nodeIds;

            widgets.forEach(function (w) {
                w.remove();
            });

            sWidget.remove();

            okBtn.off('click');

            self._configForm.empty();
            self._configContainer.hide();
            self._addPanelContainers(nodeIds);

            callback(nodeIds, delay);
        });

        this._configForm
            .append($('<div class="form-group btn-container">')
                .append($('<div class="col-sm-9 controls">'))
                .append($('<div class="col-sm-3 controls">').append(okBtn)));

        this._configContainer.show();
    };


    ContainerWidget.prototype.showWrongResult = function (reason) {
        this._configContainer.find('.configuration-title')
            .text('No valid data available');
        this._configContainer.find('.configuration-desc')
            .text(reason + ' To generate results invoke the Java BIP Engine plugin on the project.');

        this._configContainer.show();
    };

    ContainerWidget.prototype.removeNode = function (gmeId) {
        var desc = this.nodes[gmeId];
        this._el.append('<div>Removing node "' + desc.name + '"</div>');
        delete this.nodes[gmeId];
    };

    ContainerWidget.prototype.showProgressbar = function () {
        this._loader.start();
    };

    ContainerWidget.prototype.hideProgressbar = function () {
        this._loader.stop();
    };

    ContainerWidget.prototype.destroy = function () {
        var self = this;

        Object.keys(this._panels).forEach(function (key) {
            self._panels[key].panel.destroy();
        });

        self._panels = {};
        this._el.remove();
    };

    ContainerWidget.prototype.onActivate = function () {
        this._logger.debug('ContainerWidget has been activated');
    };

    ContainerWidget.prototype.onDeactivate = function () {
        this._logger.debug('ContainerWidget has been deactivated');
    };

    return ContainerWidget;
});
