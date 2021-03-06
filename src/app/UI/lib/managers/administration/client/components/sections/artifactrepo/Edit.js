
import React from "react";
import { StringUtil } from "misc";
import Component from "ui-lib/component";
import Input from "react-toolbox/lib/input";
import Dropdown from "react-toolbox/lib/dropdown";
import Checkbox from "react-toolbox/lib/checkbox";
import Autocomplete from "react-toolbox/lib/autocomplete";
import {
    Form as TAForm,
    Section as TASection,
    LoadIndicator as TALoadIndicator,
    utils as tautils
} from "ui-components/type_admin";

class Edit extends Component {
    constructor(props) {
        super(props);

        this.itemProperties = {
            "_id": {
                editable: false,
                required: () => true,
                defaultValue: ""
            },
            "tags": {
                editable: true,
                required: () => false,
                defaultValue: []
            },
            "backend": {
                editable: false,
                required: () => true,
                defaultValue: ""
            },
            "versionScheme": {
                editable: false,
                required: () => true,
                defaultValue: "default"
            },
            "hashAlgorithms": {
                editable: true,
                required: () => true,
                defaultValue: []
            }
        };

        tautils.createStateProperties(this, this.itemProperties, this.props.item);

        this.addTypeListStateVariable("backends", "artifactrepo.backend");
    }

    getVersionSchemes(backend) {
        if (!backend) {
            return [];
        }

        return backend.versionSchemes.map((item) => {
            return { value: item, label: StringUtil.toUpperCaseLetter(item) };
        });
    }

    getHashAlgorhitms(backend) {
        if (!backend) {
            return [];
        }

        return backend.hashAlgorithms.map((item) => {
            return { value: item, label: StringUtil.toUpperCaseLetter(item) };
        });
    }

    getBackends() {
        return this.state.backends.map((backend) => {
            return { value: backend._id, label: backend._id };
        });
    }

    async onConfirm() {
        const data = tautils.serialize(this, this.itemProperties, this.props.item);
        await this.props.onSave("artifactrepo.repository", data, {
            create: !this.props.item
        });
    }

    render() {
        this.log("render", this.props, this.state);

        if (this.state.loadingAsync.value) {
            return (
                <TALoadIndicator />
            );
        }

        const backend = this.state.backends.find((backend) => backend._id === this.state.backend.value);
        const backends = this.getBackends();
        const versionSchemes = this.getVersionSchemes(backend);
        const hashAlgorithms = this.getHashAlgorhitms(backend);

        return (
            <TASection
                breadcrumbs={this.props.breadcrumbs}
                controls={this.props.controls}
            >
                <TAForm
                    confirmAllowed={tautils.isValid(this, this.itemProperties)}
                    confirmText={this.props.item ? "Save" : "Create"}
                    primaryText={`${this.props.item ? "Edit" : "Create"} artifact repository`}
                    secondaryText="A artifact repository contains binary file versions"
                    onConfirm={() => this.onConfirm()}
                    onCancel={() => this.props.onCancel()}
                >
                    <Input
                        type="text"
                        label="Name"
                        name="_id"
                        floating={true}
                        required={this.itemProperties._id.required()}
                        disabled={this.props.item && !this.itemProperties._id.editable}
                        value={this.state._id.value}
                        onChange={this.state._id.set}
                    />
                    <Dropdown
                        label="Backend"
                        required={this.itemProperties.backend.required()}
                        disabled={this.props.item && !this.itemProperties.backend.editable}
                        onChange={this.state.backend.set}
                        source={backends}
                        value={this.state.backend.value}
                    />
                    <Dropdown
                        label="Version Scheme"
                        required={this.itemProperties.versionScheme.required()}
                        disabled={this.props.item && !this.itemProperties.versionScheme.editable}
                        onChange={this.state.versionScheme.set}
                        source={versionSchemes}
                        value={this.state.versionScheme.value}
                    />
                    <div>
                        <div className={this.props.theme.subtitle}>Hash Algorithms *</div>
                        {hashAlgorithms.map((item) => {
                            const checked = this.state.hashAlgorithms.value.includes(item.value);

                            return (
                                <Checkbox
                                    key={item.value}
                                    checked={checked}
                                    label={item.label}
                                    disabled={this.props.item && !this.itemProperties.hashAlgorithms.editable}
                                    onChange={(value) => {
                                        if (value.constructor !== Boolean || value === checked) {
                                            return;
                                        }

                                        let list = this.state.hashAlgorithms.value.slice(0);

                                        if (value) {
                                            list.push(item.value);
                                        } else {
                                            list = list.filter((i) => i !== item.value);
                                        }

                                        this.state.hashAlgorithms.set(list);
                                    }}
                                />
                            );
                        })}
                    </div>
                    <Autocomplete
                        selectedPosition="below"
                        allowCreate={true}
                        label="Tags"
                        disabled={this.props.item && !this.itemProperties.tags.editable}
                        onChange={this.state.tags.set}
                        source={this.state.tags.value}
                        value={this.state.tags.value}
                    />
                </TAForm>
            </TASection>
        );
    }
}

Edit.propTypes = {
    theme: React.PropTypes.object,
    item: React.PropTypes.object,
    pathname: React.PropTypes.string.isRequired,
    breadcrumbs: React.PropTypes.array.isRequired,
    controls: React.PropTypes.array.isRequired,
    onSave: React.PropTypes.func.isRequired,
    onCancel: React.PropTypes.func.isRequired
};

export default Edit;
