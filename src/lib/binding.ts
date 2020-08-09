import { Exchange, Queue, isDeepStrictEqual } from './internal';

export type Binding = { source: Exchange; destination: Exchange | Queue; pattern: string; args?: any };

export class BindingManager {
    bindings: Binding[] = [];

    rebindAll() {
        const promises = this.bindings.map((binding) => {
            const { source, destination, pattern, args } = binding;
            return BindingManager.bind(source, destination, pattern, args);
        });

        return Promise.all(promises);
    }

    unbindAll() {
        const promises = this.bindings.map((binding) => {
            const { source, destination, pattern, args } = binding;
            return this.removeBinding(source, destination, pattern, args);
        });

        return Promise.all(promises);
    }

    async addBinding(source: Exchange, destination: Exchange | Queue, pattern: string, args?: any) {
        const binding = this.findBinding(source, destination, pattern, args);
        if (binding) {
            throw new Error(`Binding of source ${source.name} and destination ${destination.name}`);
        }

        await BindingManager.bind(source, destination, pattern, args);

        const newBinding = { source, destination, pattern, args };
        this.bindings.push(newBinding);
    }

    static async bind(source: Exchange, destination: Exchange | Queue, pattern: string, args?: any) {
        if (!source.isInitialized()) {
            throw new Error(`Source ${source.name} is not initialized`);
        }

        if (!destination.isInitialized()) {
            throw new Error(`Destination ${source.name} is not initialized`);
        }

        if (destination instanceof Queue) {
            await source.getNativeChannel().bindQueue(destination.name, source.name, pattern, args);
        } else {
            await source.getNativeChannel().bindExchange(destination.name, source.name, pattern, args);
        }
    }

    static async unbind(source: Exchange, destination: Exchange | Queue, pattern: string, args?: any) {
        if (!source.isInitialized()) {
            throw new Error(`Source ${source.name} is not initialized`);
        }

        if (!destination.isInitialized()) {
            throw new Error(`Destination ${source.name} is not initialized`);
        }

        if (destination instanceof Queue) {
            await source.getNativeChannel().unbindQueue(destination.name, source.name, pattern, args);
        } else {
            await source.getNativeChannel().unbindExchange(destination.name, source.name, pattern, args);
        }
    }

    async removeBinding(source: Exchange, destination: Exchange | Queue, pattern: string, args?: any) {
        if (!source.isInitialized()) {
            throw new Error(`Source ${source.name} is not initialized`);
        }

        if (!destination.isInitialized()) {
            throw new Error(`Destination ${source.name} is not initialized`);
        }

        const binding = this.findBinding(source, destination, pattern, args);
        if (!binding) {
            throw new Error(`Binding of source ${source.name} and destination ${destination.name} does not exist`);
        }

        await BindingManager.unbind(source, destination, pattern, args);

        this.removeBindingFromArray(binding);
    }

    removeBindingFromArray(binding: Binding) {
        this.bindings = this.bindings.filter((arrayBinding) => binding !== arrayBinding);
    }

    async unbindAllBindingsForEntity(entity: Exchange | Queue) {
        if (!entity.isInitialized()) {
            throw new Error(`Entity ${entity.name} is not initialized`);
        }

        const bindings = this.bindings.filter(BindingManager.byEntity(entity));

        const promises = bindings.map((binding) => {
            const { source, destination, pattern, args } = binding;
            return this.removeBinding(source, destination, pattern, args);
        });

        return Promise.all(promises);
    }

    clearBindings() {
        this.bindings = [];
    }

    findBinding(source: Exchange, destination: Exchange | Queue, pattern?: string, args?: any) {
        let predicate: any;
        if (!pattern) {
            predicate = BindingManager.bySourceAndDestinationPredicate(source, destination);
        } else {
            predicate = BindingManager.byExactMatch(source, destination, pattern, args);
        }

        return this.bindings.find(predicate);
    }

    static isSameEntity(first: Exchange | Queue, second: Exchange | Queue) {
        if (typeof first !== typeof second) {
            return false;
        }

        return first.name === second.name;
    }

    static byEntity(entity: Exchange | Queue) {
        return (binding: Binding) => {
            return BindingManager.isSameEntity(binding.source, entity) || BindingManager.isSameEntity(binding.destination, entity);
        };
    }

    static bySourcePredicate(source: Exchange) {
        return (binding: Binding) => {
            return BindingManager.isSameEntity(binding.source, source);
        };
    }

    static byDestinationPredicate(destination: Exchange | Queue) {
        return (binding: Binding) => {
            return BindingManager.isSameEntity(binding.destination, destination);
        };
    }

    static bySourceAndDestinationPredicate(source: Exchange, destination: Exchange | Queue) {
        return (binding: Binding) => {
            return BindingManager.bySourcePredicate(source)(binding) && BindingManager.byDestinationPredicate(destination)(binding);
        };
    }

    static byExactMatch(source: Exchange, destination: Exchange | Queue, pattern?: string, args?: any) {
        return (binding: Binding) => {
            return (
                BindingManager.bySourceAndDestinationPredicate(source, destination)(binding) &&
                binding.pattern === pattern &&
                isDeepStrictEqual(binding.args, args)
            );
        };
    }
}
