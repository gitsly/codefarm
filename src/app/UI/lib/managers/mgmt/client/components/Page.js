import React from "react";
import { AppMenu } from "ui-components/app_menu";
import Component from "ui-lib/component";

class Page extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        console.log("ManagementPage-RENDER", this.props);

        const pathname = this.getPathname();

        const items = this.props.route.childRoutes.map((route) => {
            const pn = `${pathname}/${route.path}`;
            const active = this.context.router.location.pathname.startsWith(pn);

            return {
                label: route.label,
                pathname: pn,
                active: active
            };
        });

        return (
            <div>
                <AppMenu
                    primaryText="Management"
                    icon="build"
                    items={items}
                />
                <div className={this.props.theme.content}>
                    {this.props.children && React.cloneElement(this.props.children, { theme: this.props.theme })}
                </div>
            </div>
        );
    }
}

Page.propTypes = {
    theme: React.PropTypes.object,
    children: React.PropTypes.node,
    route: React.PropTypes.object.isRequired
};

Page.contextTypes = {
    router: React.PropTypes.object.isRequired
};

export default Page;
