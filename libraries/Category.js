const CONSTANTS = require("../constants");

class CategoryLibrary {
    defaultPermissions = {
        deletePosts: false
    }

    returnPermissions(categoryMember, category) {
        if (categoryMember.userId == category.categoryOwnerId || categoryMember.userId == category.categoryOriginalCreator) {
            return {
                deletePosts: true
            }
        }

        const userRoles = category.roles.filter(role => categoryMember.roles.includes(role.roleId))

        const userPermissions = {};

        for (const permission of CONSTANTS.CATEGORY_PERMISSIONS) {
            for (const role of userRoles) {
                if (role.permissions?.[permission] === true) {
                    userPermissions[permission] = true;
                    break;
                }
            }
        }

        return {...this.defaultPermissions, ...userPermissions};
    }
}

module.exports = CategoryLibrary;