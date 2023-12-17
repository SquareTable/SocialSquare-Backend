class Notifications {
    returnNotificationDataToSend(rawNotificationData) {
        return rawNotificationData.map(notification => {
            delete notification.userId;
            return notification;
        })
    }
}

module.exports = Notifications;