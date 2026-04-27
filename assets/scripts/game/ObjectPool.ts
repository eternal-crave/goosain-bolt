import { instantiate, Node, Prefab } from 'cc';

/**
 * Simple prefab pool — avoids per-frame instantiate during run.
 */
export class ObjectPool {
    private readonly _free: Node[] = [];

    public constructor(
        private readonly _prefab: Prefab,
        private readonly _parent: Node,
        initial: number,
    ) {
        for (let i = 0; i < initial; i++) {
            const n = instantiate(this._prefab);
            n.active = false;
            n.setParent(this._parent);
            this._free.push(n);
        }
    }

    public get(): Node {
        const n = this._free.pop() ?? instantiate(this._prefab);
        n.active = true;
        n.setParent(this._parent);
        return n;
    }

    public put(node: Node): void {
        node.active = false;
        node.removeFromParent();
        this._free.push(node);
    }

    public clear(): void {
        for (const n of this._free) {
            n.destroy();
        }
        this._free.length = 0;
    }
}
