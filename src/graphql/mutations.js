/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const requestFollow = /* GraphQL */ `
  mutation RequestFollow($targetUserId: ID!) {
    requestFollow(targetUserId: $targetUserId) {
      requesterId
      targetId
      status
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const acceptFollowRequest = /* GraphQL */ `
  mutation AcceptFollowRequest($requesterId: ID!) {
    acceptFollowRequest(requesterId: $requesterId) {
      requesterId
      targetId
      status
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const createNotificationInternal = /* GraphQL */ `
  mutation CreateNotificationInternal($input: CreateNotificationInput!) {
    createNotificationInternal(input: $input) {
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
export const upsertUserProfileInternal = /* GraphQL */ `
  mutation UpsertUserProfileInternal($input: UpsertUserProfileInput!) {
    upsertUserProfileInternal(input: $input) {
      id
      username
      email
      displayName
      avatarUrl
      createdAt
      __typename
    }
  }
`;
