/*globals*/
/*jshint node:true, mocha:true*/

/**
 * @author pmeijer / https://github.com/pmeijer
 */

'use strict';
var testFixture = require('../globals');

describe('CheckResultConsistency', function () {
    var gmeConfig = testFixture.getGmeConfig(),
        expect = testFixture.expect,
        logger = testFixture.logger.fork('CheckResultConsistency'),
        projectName = 'CheckResultConsistency',
        ENGINE_OUTPUT = require('../../src/visualizers/panels/BIPExecutionViz/SwitchableRoutesEngineOutput.json'),
        checkModelAndGetComponentTypes = testFixture.requirejs('panels/BIPExecutionViz/checkResultsConsistency'),
        coreData = {
            core: null,
            rootNode: null,
            commitHash: null,
            project: null,
            nodePath: null
        },
        gmeAuth,
        storage;

    before(function (done) {
        testFixture.clearDBAndGetGMEAuth(gmeConfig, projectName)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                // This uses in memory storage. Use testFixture.getMongoStorage to persist test to database.
                storage = testFixture.getMemoryStorage(logger, gmeConfig, gmeAuth);
                return storage.openDatabase();
            })
            .then(function () {
                var importParam = {
                    projectSeed: testFixture.path.join(__dirname, 'SwitchableRoutesTest.webgmex'),
                    projectName: projectName,
                    branchName: 'master',
                    logger: logger,
                    gmeConfig: gmeConfig
                };

                return testFixture.importProject(storage, importParam);
            })
            .then(function (importResult) {
                // Set the parameters needed for then checkModelAndGetComponentTypes invocation.
                coreData.core = importResult.core;
                coreData.rootNode = importResult.rootNode;
                coreData.commitHash = importResult.commitHash;
                coreData.project = importResult.project;
            })
            .nodeify(done);
    });

    after(function (done) {
        storage.closeDatabase()
            .then(function () {
                return gmeAuth.unload();
            })
            .nodeify(done);
    });

    it('should succeed on valid model', function (done) {
        var nodePath = '/f/t';

        coreData.nodePath = nodePath;

        checkModelAndGetComponentTypes(coreData, ENGINE_OUTPUT)
            .then(function (result) {
                expect(result.violation).to.equal(null);
                expect(result.componentTypes).to.deep.equal(
                    [
                        {
                            cardinality: 1,
                            id: '/f/t/y',
                            name: 'Monitor'
                        },
                        {
                            cardinality: 3,
                            id: '/f/t/1',
                            name: 'Route'
                        }
                    ]
                );
            })
            .nodeify(done);
    });

    it('should fail with more than one initial state inside ComponentType', function (done) {
        var nodePath = '/f/i';

        coreData.nodePath = nodePath;

        checkModelAndGetComponentTypes(coreData, ENGINE_OUTPUT)
            .then(function (result) {
                expect(result.violation).to.not.equal(null);
                expect(result.violation.severity).to.equal('error');
            })
            .nodeify(done);
    });
});