
import React from "react";
import Component from "ui-lib/component";
import LoadIndicator from "./LoadIndicator";
import ControlButton from "./ControlButton";

class View extends Component {
    constructor(props) {
        super(props);

        this.log("Constructor");

        this.addStateVariable("context", {});

        if (this.props.route.path.startsWith(":")) {
            this.addTypeItemStateVariable("item", (props) => props.route.type, (props) => props.params[props.route.path.substr(1)], true);
        }
    }

    render() {
        this.log("render", this.props, JSON.stringify(this.state, null, 2));

        if (this.state.errorAsync.value) {
            return (
                <div>{this.state.errorAsync.value}</div>
            );
        }

        if (this.state.loadingAsync.value) {
            return (
                <LoadIndicator
                    theme={this.props.theme}
                />
            );
        }

        const parentItems = this.props.parentItems.slice(0);

        if (this.props.item) {
            parentItems.push(this.props.item);
        }

        const props = {
            theme: this.props.theme,
            parentItems: parentItems,
            item: this.state.item,
            breadcrumbs: this.props.breadcrumbs,
            controls: [],
            pathname: this.getPathname(),
            context: this.props.context || this.state.context
        };

        if (!props.item) {
            props.breadcrumbs = props.breadcrumbs.concat({
                label: this.props.route.label,
                pathname: this.getPathname()
            });
        } else {
            props.breadcrumbs = props.breadcrumbs.concat({
                label: props.item._id,
                pathname: this.getPathname()
            });
        }

        if (this.props.children) {
            return (
                <this.props.children.type
                    {...this.props.children.props}
                    {...props}
                />
            );
        }

        if (this.state.item) {
            if (this.props.route.childRoutes) {
                if (this.props.route.childRoutes.find((route) => route.path === "create")) {
                    props.controls.push((
                        <ControlButton
                            theme={this.props.theme}
                            key="create"
                            label="Create"
                            pathname={`${props.pathname}/create`}
                        />
                    ));
                }

                if (this.props.route.childRoutes.find((route) => route.path === "edit")) {
                    props.controls.push((
                        <ControlButton
                            theme={this.props.theme}
                            key="edit"
                            label="Edit"
                            pathname={`${props.pathname}/edit`}
                        />
                    ));
                }

                if (this.props.route.childRoutes.find((route) => route.path === "remove")) {
                    props.controls.push((
                        <ControlButton
                            theme={this.props.theme}
                            key="remove"
                            label="Remove"
                            pathname={`${props.pathname}/remove`}
                        />
                    ));
                }
            }

            if (this.props.route.Item) {
                return (
                    <div>
                        <this.props.route.Item {...props} />
                    </div>
                );
            }
        }

        if (this.props.route.childRoutes.find((route) => route.path === "create")) {
            props.controls.push((
                <ControlButton
                    theme={this.props.theme}
                    key="create"
                    label="Create"
                    pathname={`${props.pathname}/create`}
                />
            ));
        }

        return (
            <this.props.route.List
                {...props}
                type={this.props.route.type}
            />
        );
    }
}

View.defaultProps = {
    parentItems: [],
    breadcrumbs: []
};

View.propTypes = {
    theme: React.PropTypes.object,
    parentItems: React.PropTypes.array,
    item: React.PropTypes.object,
    params: React.PropTypes.object.isRequired,
    route: React.PropTypes.object.isRequired,
    children: React.PropTypes.node,
    breadcrumbs: React.PropTypes.array,
    context: React.PropTypes.object
};

export default View;
