
import React from "react";
import Component from "ui-lib/component";
import Chip from "react-toolbox/lib/chip";
import { Row, Col } from "react-flexbox-grid";
import {
    Section as TASection
} from "ui-components/type_admin";

class SubJobItem extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        this.log("render", this.props, this.state);

        const controls = this.props.controls.slice(0);

        return (
            <TASection
                controls={controls}
                breadcrumbs={this.props.breadcrumbs}
            >
                <div className={this.props.theme.container}>
                    <Row>
                        <Col className={this.props.theme.panel}>
                            <div className={this.props.theme.tags}>
                                {this.props.item.tags.map((tag) => (
                                    <Chip key={tag}>{tag}</Chip>
                                ))}
                            </div>
                        </Col>
                    </Row>
                    <Row>
                        <Col xs={12} md={5} className={this.props.theme.panel}>
                            <h6 className={this.props.theme.title}>Properties</h6>
                            <table className={this.props.theme.properties}>
                                <tbody>
                                    <tr>
                                        <td>Name</td>
                                        <td>{this.props.item.name}</td>
                                    </tr>
                                    <tr>
                                        <td>Kind</td>
                                        <td>{this.props.item.kind}</td>
                                    </tr>
                                    <tr>
                                        <td>Finished</td>
                                        <td>{this.props.item.finished ? `at ${this.props.item.finished}` : "No"}</td>
                                    </tr>
                                    <tr>
                                        <td>Status</td>
                                        <td>{this.props.item.status}</td>
                                    </tr>
                                    <tr>
                                        <td>Created</td>
                                        <td>{this.props.item.created}</td>
                                    </tr>
                                    <tr>
                                        <td>Saved</td>
                                        <td>{this.props.item.saved}</td>
                                    </tr>
                                </tbody>
                            </table>
                            <h6 className={this.props.theme.title}>Result data</h6>
                            <pre>
                                {JSON.stringify(this.props.item.result, null, 2)}
                            </pre>
                        </Col>
                    </Row>
                </div>
            </TASection>
        );
    }
}

SubJobItem.propTypes = {
    theme: React.PropTypes.object,
    item: React.PropTypes.object.isRequired,
    pathname: React.PropTypes.string.isRequired,
    breadcrumbs: React.PropTypes.array.isRequired,
    controls: React.PropTypes.array.isRequired
};

export default SubJobItem;
