
import React from "react";
import { Route } from "react-router";
import {
    View as TAView,
    Edit as TAEdit,
    Remove as TARemove
} from "ui-components/type_admin";
import List from "./List";
import Item from "./Item";
import BaselineItem from "./BaselineItem";
import Edit from "./Edit";
import Remove from "./Remove";

const routes = (
    <Route
        path="baselines"
        component={TAView}
        List={List}
        type="baselinegen.specification"
        label="Baselines"
    >
        <Route
            path="create"
            component={TAEdit}
            Create={Edit}
            type="baselinegen.specification"
        />
        <Route
            path=":_id"
            component={TAView}
            Item={Item}
            type="baselinegen.specification"
        >
            <Route
                path="edit"
                component={TAEdit}
                Edit={Edit}
            />
            <Route
                path="remove"
                component={TARemove}
                Remove={Remove}
            />
            <Route
                path=":_id_baseline"
                component={TAView}
                Item={BaselineItem}
                type="baselinegen.baseline"
            />
        </Route>
    </Route>
);

export default routes;
