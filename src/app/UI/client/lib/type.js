
import api from "api.io/api.io-client";
import sift from "sift";
import loader from "ui-lib/loader";

class Type {
    constructor() {
        this.counter = 0;
        this.subscriptions = {};
    }

    _createSubscription(item, type, query, dataFn) {
        const subscription = {
            id: this.counter++,
            dead: false,
            item: item,
            type: type,
            query: query,
            lastValue: null,
            lastError: null,
            dataFn: dataFn,
            apiEvents: [],
            loader: loader.create(),
            fetch: async () => {
                subscription.loader.set();

                try {
                    const data = await api.type.get(subscription.type, subscription.query);
                    subscription.setData(subscription.item ? data[0] : data);
                } catch (error) {
                    subscription.setError(error);
                    throw error;
                }
            },
            addEventHandler: (event, handlerFn) => {
                subscription.logInfo(`Added event handler for ${event}`, api);
                subscription.apiEvents.push(api.type.on(event, (data) => {
                    subscription.logInfo(`Got event ${event}`, data);
                    handlerFn(data);
                }));
            },
            setData: (data) => {
                if (subscription.dead) {
                    return;
                }

                subscription.loader.unset();
                subscription.lastError = null;
                subscription.lastValue = data;
                subscription.logInfo("Got data", subscription.lastValue);
                subscription.dataFn(subscription.lastValue);
            },
            setError: (error) => {
                if (subscription.dead) {
                    return;
                }

                subscription.loader.unset();
                subscription.lastError = error;
                subscription.lastValue = subscription.item ? null : [];
                subscription.logError(error);
                subscription.dataFn(subscription.lastValue);
            },
            logInfo: (msg, ...args) => {
                console.log(`Subscription[${subscription.id}]: ${msg}`, ...args);
            },
            logError: (error) => {
                console.error(`Subscription[${subscription.id}]: Error`, error);
            },
            dispose: () => {
                for (const apiEvent of subscription.apiEvents) {
                    api.type.off(apiEvent);
                }

                subscription.dead = true;
                subscription.loader.dispose();

                delete this.subscriptions[subscription.id];
            }
        };

        this.subscriptions[subscription.id] = subscription;

        return subscription;
    }

    async fetchItem(type, id) {
        let data = [];
        const indicator = loader.create();

        indicator.set();

        try {
            data = await api.type.get(type, { _id: id });
        } catch (error) {
            throw error;
        } finally {
            indicator.unset();
            indicator.dispose();
        }

        return data[0] || null;
    }

    async fetchList(type, query) {
        let data = [];
        const indicator = loader.create();

        indicator.set();

        try {
            data = await api.type.get(type, query);
        } catch (error) {
            throw error;
        } finally {
            indicator.unset();
            indicator.dispose();
        }

        return data;
    }

    async subscribeToItemAsync(...args) {
        const [ subscription, promise ] = this._subscribeToItem(...args);

        await promise;

        return subscription.id;
    }

    async subscribeToListAsync(...args) {
        const [ subscription, promise ] = this._subscribeToList(...args);

        await promise;

        return subscription.id;
    }

    subscribeToItem(...args) {
        const [ subscription, promise ] = this._subscribeToItem(...args);

        promise.catch((error) => console.error(error));

        return subscription.id;
    }

    subscribeToList(...args) {
        const [ subscription, promise ] = this._subscribeToList(...args);

        promise.catch((error) => console.error(error));

        return subscription.id;
    }

    _subscribeToItem(type, id, dataFn) {
        const subscription = this._createSubscription(true, type, { _id: id }, dataFn);

        subscription.logInfo(`Creating item subscription for id ${id}`);

        subscription.addEventHandler(`created.${type}.${id}`, (payload) => {
            if (subscription.dead) {
                return;
            }

            subscription.setData(payload.newdata);
        });

        subscription.addEventHandler(`updated.${type}.${id}`, (payload) => {
            if (subscription.dead) {
                return;
            }

            subscription.setData(payload.newdata);
        });

        subscription.addEventHandler(`removed.${type}.${id}`, () => {
            if (subscription.dead) {
                return;
            }

            subscription.setData(null);
        });

        subscription.logInfo("Subscription created", subscription);

        return [ subscription.id, subscription.fetch() ];
    }

    _subscribeToList(type, query, dataFn) {
        const subscription = this._createSubscription(false, type, query, dataFn);

        subscription.logInfo(`Creating list subscription for query ${JSON.stringify(query)}`);

        subscription.addEventHandler(`created.${type}`, (payload) => {
            if (subscription.dead) {
                return;
            }

            const data = sift(subscription.query, [ payload.newdata ])[0];

            // If data matched query, we should add it to our list
            if (data) {
                const list = subscription.lastValue.slice(0);
                list.push(data);
                subscription.setData(list);
            }
        });

        subscription.addEventHandler(`updated.${type}`, (payload) => {
            if (subscription.dead) {
                return;
            }

            const data = sift(subscription.query, [ payload.newdata ])[0];
            const index = subscription.lastValue.findIndex((item) => item._id === payload.newdata._id);

            // If data matches query we must handle it
            if (data) {
                const list = subscription.lastValue.slice(0);

                // If data already exists in our list replace it,
                // if it does not exist add it
                if (index !== -1) {
                    list[index] = data;
                } else {
                    list.push(data);
                }

                subscription.setData(list);
            } else if (index !== -1) {
                const list = subscription.lastValue.slice(0);

                // Item exists in our list but no longer matches query,
                // we should remove it
                list.splice(index, 1);

                subscription.setData(list);
            }
        });

        subscription.addEventHandler(`removed.${type}`, (payload) => {
            if (subscription.dead) {
                return;
            }

            const data = sift(subscription.query, [ payload.olddata ])[0];
            const index = subscription.lastValue.findIndex((item) => item._id === data._id);

            // If data matches our query and is in our list (it should be!),
            // we should remove it
            if (data && index !== -1) {
                const list = subscription.lastValue.slice(0);

                list.splice(index, 1);

                subscription.setData(list);
            }
        });

        subscription.logInfo("Subscription created", subscription);

        return [ subscription.id, subscription.fetch() ];
    }

    unsubscribe(subscriptionId) {
        const subscription = this.subscriptions[subscriptionId];

        if (subscription) {
            subscription.logInfo("Unsubscribing...", subscription);
            subscription.dispose();
            subscription.logInfo("Unsubscribed", subscription);
        }
    }
}

export default new Type();
