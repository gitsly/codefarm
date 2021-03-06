
import React from "react";
import api from "api.io/api.io-client";
import Component from "ui-lib/component";
import Chip from "react-toolbox/lib/chip";
import { Row, Col } from "react-flexbox-grid";
import {
    Section as TASection,
    List as TAList,
    ControlButton as TAControlButton
} from "ui-components/type_admin";

class Item extends Component {
    constructor(props) {
        super(props);
    }

    async onForceRequest() {
        const response = await api.type.action(
            "baselinegen.specification",
            this.props.item._id,
            "request"
        );

        if (response.result !== "success") {
            console.error("onForceRequest: Couldn't request baseline, response=", response);
        } else {
            console.log("onForceRequest: ", response);
        }
    }

    render() {
        this.log("render", this.props, this.state);

        const controls = this.props.controls.slice(0);

        controls.push((
            <TAControlButton
                key="force"
                label="Force request"
                onClick={() => this.onForceRequest()}
            />
        ));

        return (
            <TASection
                controls={controls}
                breadcrumbs={this.props.breadcrumbs}
            >
                <div className={this.props.theme.container}>
                    <Row>
                        <Col xs={12} md={5} className={this.props.theme.panel}>
                            <div className={this.props.theme.tags}>
                                {this.props.item.tags.map((tag) => (
                                    <Chip key={tag}>{tag}</Chip>
                                ))}
                            </div>
                            {this.props.item.collectors.map((collector) => (
                                <div key={collector.name}>
                                    <h6 className={this.props.theme.title}>
                                        Collector: {collector.name}
                                    </h6>
                                    <table className={this.props.theme.properties}>
                                        <tbody>
                                            <tr>
                                                <td>Type</td>
                                                <td>{collector.collectType}</td>
                                            </tr>
                                            <tr>
                                                <td>Criteria</td>
                                                <td>{collector.criteria}</td>
                                            </tr>
                                            <tr>
                                                <td>Limit</td>
                                                <td>{collector.limit}</td>
                                            </tr>
                                            <tr>
                                                <td>Latest</td>
                                                <td>{collector.latest ? "Yes" : "No"}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            ))}
                        </Col>
                        <Col xs={12} md={7} className={this.props.theme.panel}>
                            <h6 className={this.props.theme.title}>Generated baselines</h6>
                            <TAList
                                type="baselinegen.baseline"
                                query={{ name: this.props.item._id }}
                                onSelect={(item) => {
                                    this.context.router.push({
                                        pathname: `${this.props.pathname}/${item._id}`
                                    });
                                }}
                            />
                        </Col>
                    </Row>
                </div>
            </TASection>
        );
    }
}

Item.propTypes = {
    theme: React.PropTypes.object,
    item: React.PropTypes.object.isRequired,
    pathname: React.PropTypes.string.isRequired,
    breadcrumbs: React.PropTypes.array.isRequired,
    controls: React.PropTypes.array.isRequired
};

Item.contextTypes = {
    router: React.PropTypes.object.isRequired
};

export default Item;
