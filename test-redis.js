const { client, redisHelpers, REDIS_KEYS } = require('./redis.js');

// Test configuration
const TEST_CONFIG = {
    playerId: 'test_player_' + Date.now(),
    testTimeout: 5000,
    cleanupAfterTests: true
};

// Test results tracking
let testResults = {
    passed: 0,
    failed: 0,
    total: 0
};

// Utility functions
function logTest(testName, passed, details = '') {
    testResults.total++;
    if (passed) {
        testResults.passed++;
        console.log(`✅ ${testName}${details ? ' - ' + details : ''}`);
    } else {
        testResults.failed++;
        console.log(`❌ ${testName}${details ? ' - ' + details : ''}`);
    }
}

function logSection(title) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🧪 ${title}`);
    console.log(`${'='.repeat(50)}`);
}

function logSummary() {
    console.log(`\n${'='.repeat(50)}`);
    console.log('📊 TEST SUMMARY');
    console.log(`${'='.repeat(50)}`);
    console.log(`Total Tests: ${testResults.total}`);
    console.log(`Passed: ${testResults.passed} ✅`);
    console.log(`Failed: ${testResults.failed} ❌`);
    console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
    
    if (testResults.failed === 0) {
        console.log('\n🎉 All tests passed! Redis integration is working perfectly!');
    } else {
        console.log('\n⚠️  Some tests failed. Please check the Redis connection and configuration.');
    }
}

// Test functions
async function testBasicOperations() {
    logSection('BASIC REDIS OPERATIONS');
    
    try {
        // Test SET operation
        const testData = { message: 'Hello Redis!', timestamp: Date.now(), number: 42 };
        const setResult = await redisHelpers.set('test:basic:set', testData);
        logTest('SET operation', setResult === true);
        
        // Test GET operation
        const retrievedData = await redisHelpers.get('test:basic:set');
        const getPassed = retrievedData && retrievedData.message === testData.message;
        logTest('GET operation', getPassed, `Retrieved: ${retrievedData?.message}`);
        
        // Test EXISTS operation
        const existsResult = await redisHelpers.exists('test:basic:set');
        logTest('EXISTS operation', existsResult === true);
        
        // Test DELETE operation
        const deleteResult = await redisHelpers.del('test:basic:set');
        logTest('DELETE operation', deleteResult === true);
        
        // Test GET after DELETE
        const afterDelete = await redisHelpers.get('test:basic:set');
        logTest('GET after DELETE', afterDelete === null, 'Should return null');
        
    } catch (error) {
        logTest('Basic operations', false, error.message);
    }
}

async function testPlayerStats() {
    logSection('PLAYER STATS FUNCTIONALITY');
    
    try {
        // Test initial stats
        const initialStats = await redisHelpers.getPlayerStats(TEST_CONFIG.playerId);
        const hasDefaultStats = initialStats && 
            initialStats.level === 1 && 
            initialStats.experience === 0 && 
            initialStats.coins === 0;
        logTest('Default stats initialization', hasDefaultStats, 
            `Level: ${initialStats?.level}, Exp: ${initialStats?.experience}, Coins: ${initialStats?.coins}`);
        
        // Test stat increments
        await redisHelpers.incrementPlayerStat(TEST_CONFIG.playerId, 'hayEaten', 5);
        await redisHelpers.incrementPlayerStat(TEST_CONFIG.playerId, 'experience', 50);
        
        const updatedStats = await redisHelpers.getPlayerStats(TEST_CONFIG.playerId);
        const incrementsWorked = updatedStats && 
            updatedStats.hayEaten === 5 && 
            updatedStats.experience === 50;
        logTest('Stat increments', incrementsWorked, 
            `Hay eaten: ${updatedStats?.hayEaten}, Exp: ${updatedStats?.experience}`);
        
        // Test stat updates
        await redisHelpers.updatePlayerStats(TEST_CONFIG.playerId, { 
            level: 5, 
            timePlayed: 3600 
        });
        
        const finalStats = await redisHelpers.getPlayerStats(TEST_CONFIG.playerId);
        const updatesWorked = finalStats && 
            finalStats.level === 5 && 
            finalStats.timePlayed === 3600;
        logTest('Stat updates', updatesWorked, 
            `Level: ${finalStats?.level}, Time: ${finalStats?.timePlayed}s`);
        
        // Test multiple increments
        await redisHelpers.incrementPlayerStat(TEST_CONFIG.playerId, 'hayEaten', 10);
        const multiIncrementStats = await redisHelpers.getPlayerStats(TEST_CONFIG.playerId);
        logTest('Multiple increments', multiIncrementStats.hayEaten === 15, 
            `Total hay eaten: ${multiIncrementStats.hayEaten}`);
        
    } catch (error) {
        logTest('Player stats', false, error.message);
    }
}

async function testGlobalStats() {
    logSection('GLOBAL STATS FUNCTIONALITY');
    
    try {
        // Test initial global stats
        const initialGlobalStats = await redisHelpers.getGlobalStats();
        const hasDefaultGlobalStats = initialGlobalStats && 
            typeof initialGlobalStats.totalPlayers === 'number' &&
            typeof initialGlobalStats.totalHayEaten === 'number';
        logTest('Default global stats initialization', hasDefaultGlobalStats,
            `Total players: ${initialGlobalStats?.totalPlayers}`);
        
        // Test global stat increments
        await redisHelpers.incrementGlobalStat('totalHayEaten', 25);
        await redisHelpers.incrementGlobalStat('totalPlayers', 1);
        
        const updatedGlobalStats = await redisHelpers.getGlobalStats();
        const globalIncrementsWorked = updatedGlobalStats &&
            updatedGlobalStats.totalHayEaten >= 25;
        logTest('Global stat increments', globalIncrementsWorked,
            `Hay eaten: ${updatedGlobalStats?.totalHayEaten}, Players: ${updatedGlobalStats?.totalPlayers}`);
        
        // Test global stat updates
        await redisHelpers.updateGlobalStats({ 
            serverUptime: 86400,
            activePlayers: 10 
        });
        
        const finalGlobalStats = await redisHelpers.getGlobalStats();
        const globalUpdatesWorked = finalGlobalStats &&
            finalGlobalStats.serverUptime === 86400 &&
            finalGlobalStats.activePlayers === 10;
        logTest('Global stat updates', globalUpdatesWorked,
            `Uptime: ${finalGlobalStats?.serverUptime}s, Active: ${finalGlobalStats?.activePlayers}`);
        
    } catch (error) {
        logTest('Global stats', false, error.message);
    }
}

async function testDataPersistence() {
    logSection('DATA PERSISTENCE');
    
    try {
        // Test that data persists across operations
        const testKey = 'test:persistence:' + Date.now();
        const testValue = { data: 'persistent', timestamp: Date.now() };
        
        await redisHelpers.set(testKey, testValue);
        const retrieved1 = await redisHelpers.get(testKey);
        const firstRetrieval = retrieved1 && retrieved1.data === testValue.data;
        logTest('First data retrieval', firstRetrieval);
        
        // Simulate some time passing and retrieve again
        await new Promise(resolve => setTimeout(resolve, 100));
        const retrieved2 = await redisHelpers.get(testKey);
        const secondRetrieval = retrieved2 && retrieved2.data === testValue.data;
        logTest('Second data retrieval', secondRetrieval, 'Data should persist');
        
        // Clean up
        await redisHelpers.del(testKey);
        
    } catch (error) {
        logTest('Data persistence', false, error.message);
    }
}

async function testErrorHandling() {
    logSection('ERROR HANDLING');
    
    try {
        // Test with invalid player ID
        const invalidStats = await redisHelpers.getPlayerStats('');
        logTest('Invalid player ID handling', invalidStats !== null, 'Should return default stats');
        
        // Test with null values
        const nullResult = await redisHelpers.set('test:null', null);
        logTest('Null value handling', nullResult === true, 'Should handle null gracefully');
        
        // Test with undefined values
        const undefinedResult = await redisHelpers.set('test:undefined', undefined);
        logTest('Undefined value handling', undefinedResult === true, 'Should handle undefined gracefully');
        
        // Clean up
        await redisHelpers.del('test:null');
        await redisHelpers.del('test:undefined');
        
    } catch (error) {
        logTest('Error handling', false, error.message);
    }
}

async function testPerformance() {
    logSection('PERFORMANCE TESTS');
    
    try {
        const startTime = Date.now();
        
        // Test multiple rapid operations
        const promises = [];
        for (let i = 0; i < 10; i++) {
            promises.push(redisHelpers.set(`test:perf:${i}`, { index: i, timestamp: Date.now() }));
        }
        
        await Promise.all(promises);
        
        // Retrieve all
        const retrievePromises = [];
        for (let i = 0; i < 10; i++) {
            retrievePromises.push(redisHelpers.get(`test:perf:${i}`));
        }
        
        const results = await Promise.all(retrievePromises);
        const allRetrieved = results.every(result => result !== null);
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        logTest('Bulk operations performance', allRetrieved, 
            `${results.length} operations in ${duration}ms`);
        
        // Clean up
        const cleanupPromises = [];
        for (let i = 0; i < 10; i++) {
            cleanupPromises.push(redisHelpers.del(`test:perf:${i}`));
        }
        await Promise.all(cleanupPromises);
        
    } catch (error) {
        logTest('Performance tests', false, error.message);
    }
}

async function cleanup() {
    if (TEST_CONFIG.cleanupAfterTests) {
        logSection('CLEANUP');
        
        try {
            // Clean up test data
            const keysToDelete = [
                REDIS_KEYS.PLAYER_STATS + TEST_CONFIG.playerId,
            ];
            
            for (const key of keysToDelete) {
                await redisHelpers.del(key);
            }
            
            console.log('🧹 Test data cleaned up');
            
        } catch (error) {
            console.log('⚠️  Cleanup failed:', error.message);
        }
    }
}

// Main test runner
async function runAllTests() {
    console.log('🚀 Starting Redis Integration Tests...');
    console.log(`Test Player ID: ${TEST_CONFIG.playerId}`);
    console.log(`Test Timeout: ${TEST_CONFIG.testTimeout}ms`);
    
    try {
        // Run all test suites
        await testBasicOperations();
        await testPlayerStats();
        await testGlobalStats();
        await testDataPersistence();
        await testErrorHandling();
        await testPerformance();
        
        // Cleanup
        await cleanup();
        
        // Show summary
        logSummary();
        
    } catch (error) {
        console.error('💥 Test suite failed:', error);
        testResults.failed++;
        logSummary();
    } finally {
        // Close Redis connection
        await client.quit();
        console.log('\n🔌 Redis connection closed');
    }
}

// Run tests with timeout
const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Test timeout')), TEST_CONFIG.testTimeout);
});

Promise.race([runAllTests(), timeoutPromise])
    .catch(error => {
        console.error('⏰ Test timeout or error:', error.message);
        process.exit(1);
    }); 