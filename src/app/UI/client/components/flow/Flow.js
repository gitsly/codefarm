
import React from "react";
import Component from "ui-lib/component";
import { SvgGrid, SvgGridItem, SvgGridPath } from "ui-components/svg_grid";
import StepVirtual from "./steps/Virtual";

class Flow extends Component {
    constructor(props) {
        super(props);
    }

    getAllParents(items, item) {
        let parents = items.filter((i) => item.parentIds.includes(i.id));

        for (const parent of parents) {
            parents = parents.concat(this.getAllParents(items, parent));
        }

        return parents;
    }

    getAllChildren(items, item) {
        let children = items.filter((i) => i.parentIds.includes(item.id));

        for (const child of children) {
            children = children.concat(this.getAllChildren(items, child));
        }

        return children;
    }

    setParentWeight(items, parent = false, weight = 0) {
        let children;

        if (!parent) {
            children = items.filter((i) => i.parentIds.length === 0);
        } else {
            children = items.filter((i) => i.parentIds.includes(parent.id));
        }

        for (let n = 0; n < children.length; n++) {
            children[n].weight = Math.max(children[n].weight, parseInt(`${weight}${children.length - n}`, 10));
            this.setParentWeight(items, children[n], children[n].weight);
        }
    }

    getFlow(steps) {
        const items = steps.map((step) => {
            const item = {
                id: step.id,
                name: step.name,
                type: step.type,
                meta: step.meta || {},
                disabled: () => step.disabled(item),
                active: () => step.active(item),
                secondary: step.secondary,
                parentIds: step.parentIds,
                handlers: step.handlers,
                columnSpan: this.props.columnSpan,
                rowSpan: this.props.rowSpan,
                weight: 0,
                getAllParents: () => this.getAllParents(items, item),
                getAllChildren: () => this.getAllChildren(items, item)
            };

            return item;
        });

        this.setParentWeight(items);

        items.sort((a, b) => a.weight - b.weight);

        // Calculate columns
        for (const item of items) {
            const columns = items
                .filter((i) => item.parentIds.includes(i.id))
                .map((i) => i.column);

            item.column = 1;

            if (columns.length > 0) {
                const maxColumn = Math.max(...columns);
                item.column = maxColumn + this.props.columnSpan + 1;
            }
        }

        // Insert virtual items
        let virtualCount = 1;
        items.slice(0).forEach((item) => {
            const children = items.filter((i) => i.parentIds.includes(item.id));

            for (const child of children) {
                let previousItem = item;

                for (let c = item.column; c < child.column - (this.props.columnSpan + 1); c += (this.props.columnSpan + 1)) {
                    const vitem = {
                        id: `virtual-${virtualCount++}`,
                        type: StepVirtual,
                        meta: {},
                        disabled: () => true,
                        active: () => false,
                        secondary: false,
                        handlers: {},
                        parentIds: [ previousItem.id ],
                        columnSpan: this.props.columnSpan,
                        rowSpan: 1,
                        getAllParents: () => this.getAllParents(items, vitem),
                        getAllChildren: () => this.getAllChildren(items, vitem)
                    };

                    items.push(vitem);
                    previousItem = vitem;
                }

                if (previousItem !== item) {
                    child.parentIds.splice(child.parentIds.indexOf(item.id), 1);
                    child.parentIds.push(previousItem.id);
                }
            }
        });

        // Re-Calculate weight with new virtual items
        for (const item of items) {
            item.weight = 0;
        }

        this.setParentWeight(items);

        // Sort, last column first
        items.sort((a, b) => a.weight - b.weight);

        // Re-Calculate columns
        for (const item of items) {
            const previous = items.filter((i) => item.parentIds.includes(i.id));

            item.column = 1;

            if (previous.length > 0) {
                const maxColumn = Math.max(...previous.map((item) => item.column));
                item.column = maxColumn + this.props.columnSpan + this.props.pathSpan;
            }
        }

        for (const item of items) {
            const neighbours = items.filter((i) => item.column === i.column);

            item.row = 0;

            for (let i = 0; i < neighbours.indexOf(item); i++) {
                item.row += neighbours[i].rowSpan;
            }
        }

        for (const item of items) {
            const neighbours = items.filter((i) => item.column === i.column);

            let height = 0;

            for (const neighbour of neighbours) {
                height += neighbour.rowSpan;
            }

            item.row -= height / 2;
        }

        // Calculate some mins
        const minColumn = Math.min(...items.map((item) => item.column));
        const minRow = Math.min(...items.map((item) => item.row));

        // Compensate coordinates
        for (const item of items) {
            item.column = item.column - minColumn;
            item.row = item.row - minRow;
        }

        // Calculate some max
        const maxColumn = Math.max(...items.map((item) => item.column)) + this.props.columnSpan;
        const maxRow = Math.max(...items.map((item) => item.row)) + this.props.rowSpan;

        // Calculate paths
        const paths = [];

        for (const item of items) {
            for (const parentId of item.parentIds) {
                paths.push({
                    from: parentId,
                    to: item.id
                });
            }
        }

        return { items: items, paths: paths, rows: maxRow, columns: maxColumn };
    }

    render() {
        this.log("render", this.props);

        if (this.props.steps.length === 0) {
            return null;
        }

        const flow = this.getFlow(this.props.steps);
        this.log("Flow", flow);

        return (
            <SvgGrid
                border={this.props.border}
                theme={this.props.theme}
                width={flow.columns * this.props.gridSize}
                height={flow.rows * this.props.gridSize}
                columns={flow.columns}
                rows={flow.rows}
            >
                {flow.paths.map((path) => (
                    <SvgGridPath
                        key={`${path.from}-${path.to}`}
                        fromKey={path.from}
                        toKey={path.to}
                        toMargin={-7}
                        fromMargin={-7}
                    />
                ))}
                {flow.items.map((item) => (
                    <SvgGridItem
                        border={this.props.border}
                        column={item.column}
                        row={item.row}
                        columnSpan={item.columnSpan}
                        rowSpan={item.rowSpan}
                        key={item.id}
                        onClick={!item.disabled() && item.handlers.onClick ? item.handlers.onClick : null}
                    >
                        <item.type
                            theme={this.props.theme}
                            item={item}
                        />
                    </SvgGridItem>
                ))}
            </SvgGrid>
        );
    }
}

Flow.defaultProps = {
    gridSize: 25,
    columnSpan: 8,
    rowSpan: 3,
    pathSpan: 2
};

Flow.propTypes = {
    theme: React.PropTypes.object,
    steps: React.PropTypes.array.isRequired,
    border: React.PropTypes.bool,
    gridSize: React.PropTypes.number,
    columnSpan: React.PropTypes.number,
    rowSpan: React.PropTypes.number,
    pathSpan: React.PropTypes.number
};

export default Flow;
