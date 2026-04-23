/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const onFollowAccepted = /* GraphQL */ `
  subscription OnFollowAccepted($requesterId: ID!) {
    onFollowAccepted(requesterId: $requesterId) {
      requesterId
      targetId
      status
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onNotification = /* GraphQL */ `
  subscription OnNotification($recipientId: ID!) {
    onNotification(recipientId: $recipientId) {
      id
      recipientId
      senderId
      type
      read
      createdAt
      __typename
    }
  }
`;
