/*globals define*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */

define(['q'], function (Q) {
    'use strict';

    /**
     *
     * @param {object} coreData - Core and nodes
     * @param {Core} coreData.core - core instance
     * @param {Core~Node} coreData.rootNode - The root-node that was loaded.
     * @param {string} coreData.commitHash - The commitHash used as basis for loading root-node.
     * @param {Project} coreData.project - A reference to the project.
     * @param {string} coreData.nodePath - Path to current node (project).
     * @param {object} data - ./SwitchableRoutesEngineOutput.json for example structure.
     * @param [callback]
     * @returns {Promise}
     */
    function checkModelAndGetComponentTypes (coreData, data, callback) {
        var core = coreData.core,
            result = {
                componentTypes: [
                    //{
                    //  id: <pathToNode>
                    //  name: <name>
                    //  cardinality: <number>
                    //}
                ],
                violation: null
                //{
                //  message: 'Model is missing nodes reported in result data.' ||
                //            'Model has more nodes than reported in model'
                //  severity: 'warning' || 'error',
                //}
            },
            META = {},
            metaNodes,
            currentNode;

        function checkComponentType(node) {
            var id;
            var initStateNum = 0;

            id = core.getPath(node);
            if (!data.info.componentTypes[id]) { // check a component type does exist
                result.violation = {
                    message: 'Missing nodes in resulted data.',
                    severity: 'error',
                };
                return Q.resolve();
            } else {
                return core.loadChildren(node) // check each component type has unique initial state
                    .then(function (children) {
                        children.forEach(function (childNode) {
                            var childMetaType = core.getBaseType(childNode);
                            if (childMetaType === 'InitialState') {
                                initStateNum = initStateNum + 1;
                            }
                            //console.log(core.getAttribute(childNode, 'name'), ' - ', core.getPath(childNode));
                        });
                    })
                    .then(function () {
                        if (initStateNum > 1) {
                            result.violation = {
                                message: 'Component type has more than one initial state',
                                severity: 'error',
                            };
                        }

                    });
            }

        }

        function visitorFn(node, done) {
            var id;

            try {
                id = core.getPath(node);

                if (core.getBaseType(node) === META.ComponentType) {
                    checkComponentType(node)
                        .then(function () {
                            result.componentTypes.push({
                                id: id,
                                name: core.getAttribute(node, 'name'),
                                cardinality: data.info.componentTypes[id].cardinality
                            });
                        })
                        .finally(done);
                } else {
                    done();
                }
            } catch (err) {
                done(err);
            }
        }

        metaNodes = core.getAllMetaNodes(coreData.rootNode);
        Object.keys(metaNodes).forEach(function (metaPath) {
            var name = core.getAttribute(metaNodes[metaPath], 'name');

            META[name] = metaNodes[metaPath];
        });

        return core.loadByPath(coreData.rootNode, coreData.nodePath)
            .then(function (currentNode_) {
                currentNode = currentNode_;
                return core.traverse(currentNode, {}, visitorFn);
            })
            .then(function () {
                // TODO: Make final checks here

                result.componentTypes.sort(function (a, b) {
                    if (a.name.toLowerCase() > b.name.toLowerCase()) {
                        return 1;
                    } else if (a.name.toLowerCase() === b.name.toLowerCase()) {
                        return 0;
                    } else {
                        return -1;
                    }
                });

                return result;
            })
            .nodeify(callback);
    }

    return checkModelAndGetComponentTypes;
});