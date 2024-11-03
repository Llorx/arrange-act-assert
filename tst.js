const { AsyncLocalStorage } = require("async_hooks");

let storeId = 0;
const asyncLocalStorage = new AsyncLocalStorage();
asyncLocalStorage.run(storeId++, async () => {
    setTimeout(() => {
        console.log("Timeout 1", asyncLocalStorage.getStore());
        setTimeout(() => {
            console.log("Timeout 1 again", asyncLocalStorage.getStore());
        }, 1000);
    }, 1000);
    console.log(asyncLocalStorage.getStore());
}).then(() => {
    console.log("DONE 0!");
});
asyncLocalStorage.run(storeId++, async () => {
    setTimeout(() => {
        console.log("Timeout 2", asyncLocalStorage.getStore());
    }, 500);
}).then(() => {
    console.log("DONE 1!");
});