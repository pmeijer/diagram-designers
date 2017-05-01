/*globals define, _, WebGMEGlobal*/
/*jshint browser: true*/
/**
 * This panel composes the inner panels and controls the simulation steps.
 */

define([
    'js/PanelBase/PanelBaseWithHeader',
    'js/PanelManager/IActivePanel',
    './ContainerControl',
    './ContainerWidget'
], function (PanelBaseWithHeader,
             IActivePanel,
             ContainerControl,
             ContainerWidget) {
    'use strict';

    function ContainerPanel(layoutManager, params) {
        var options = {};
        //set properties from options
        options[PanelBaseWithHeader.OPTIONS.LOGGER_INSTANCE_NAME] = 'BIPExecutionVizPanel';
        options[PanelBaseWithHeader.OPTIONS.FLOATING_TITLE] = true;

        //call parent's constructor
        PanelBaseWithHeader.apply(this, [options, layoutManager]);

        this._client = params.client;

        //initialize UI
        this._initialize(layoutManager);

        this.logger.debug('ctor finished');
    }

    //inherit from PanelBaseWithHeader
    _.extend(ContainerPanel.prototype, PanelBaseWithHeader.prototype);
    _.extend(ContainerPanel.prototype, IActivePanel.prototype);

    ContainerPanel.prototype._initialize = function (layoutManager) {
        var self = this;

        //set Widget title
        this.setTitle('');

        this.widget = new ContainerWidget(this.logger, this.$el);

        this.widget.setTitle = function (title) {
            self.setTitle(title);
        };

        this.control = new ContainerControl({
            logger: this.logger,
            client: this._client,
            widget: this.widget,
            layoutManager: layoutManager
        });

        this.control.setReadOnly = function () {
            self.setReadOnly(true);
        };

        this.onActivate();
    };

    /* OVERRIDE FROM WIDGET-WITH-HEADER */
    /* METHOD CALLED WHEN THE WIDGET'S READ-ONLY PROPERTY CHANGES */
    ContainerPanel.prototype.onReadOnlyChanged = function (isReadOnly) {
        //apply parent's onReadOnlyChanged
        PanelBaseWithHeader.prototype.onReadOnlyChanged.call(this, isReadOnly);
        //this.widget.setReadOnly(isReadOnly);
    };

    ContainerPanel.prototype.onResize = function (width, height) {
        this.logger.debug('onResize --> width: ' + width + ', height: ' + height);
        this.widget.onWidgetContainerResize(width, height);
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    ContainerPanel.prototype.destroy = function () {
        this.control.destroy();
        this.widget.destroy();

        PanelBaseWithHeader.prototype.destroy.call(this);
        WebGMEGlobal.KeyboardManager.setListener(undefined);
        WebGMEGlobal.Toolbar.refresh();
    };

    ContainerPanel.prototype.onActivate = function () {
        this.widget.onActivate();
        this.control.onActivate();
        WebGMEGlobal.KeyboardManager.setListener(this.widget);
        WebGMEGlobal.Toolbar.refresh();
    };

    ContainerPanel.prototype.onDeactivate = function () {
        this.widget.onDeactivate();
        this.control.onDeactivate();
        WebGMEGlobal.KeyboardManager.setListener(undefined);
        WebGMEGlobal.Toolbar.refresh();
    };

    ContainerPanel.prototype.getValidTypesInfo = function (/*nodeId, aspect*/) {
        return {};
    };

    return ContainerPanel;
});
