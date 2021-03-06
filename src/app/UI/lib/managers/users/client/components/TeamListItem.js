
import React from "react";
import Chip from "react-toolbox/lib/chip";
import Component from "ui-lib/component";
import { ListItem } from "react-toolbox/lib/list";

class UserListItem extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        this.log("render", this.props, this.state);

        const item = this.props.item;

        return (
            <ListItem
                onClick={() => {
                    if (this.props.onClick) {
                        this.props.onClick(item);
                    }
                }}
                selectable={!!this.props.onClick}
                caption={`${item.name}`}
                rightActions={item.tags.map((tag) => (
                    <Chip key={tag}>{tag}</Chip>
                ))}
            />
        );
    }
}

UserListItem.propTypes = {
    theme: React.PropTypes.object,
    item: React.PropTypes.object.isRequired,
    itemContext: React.PropTypes.array,
    onClick: React.PropTypes.func
};

export default UserListItem;
