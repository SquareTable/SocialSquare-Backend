class Notifications {
    returnNotificationDataToSend(rawNotificationData) {
        return rawNotificationData.map(notification => {
            delete notification.userId;
            notification._id = String(notification._id)
            return notification;
        })
    }
}

module.exports = Notifications;