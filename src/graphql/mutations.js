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
export const createUser = /* GraphQL */ `
  mutation CreateUser(
    $input: CreateUserInput!
    $condition: ModelUserConditionInput
  ) {
    createUser(input: $input, condition: $condition) {
      id
      username
      email
      displayName
      avatarUrl
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const updateUser = /* GraphQL */ `
  mutation UpdateUser(
    $input: UpdateUserInput!
    $condition: ModelUserConditionInput
  ) {
    updateUser(input: $input, condition: $condition) {
      id
      username
      email
      displayName
      avatarUrl
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const deleteUser = /* GraphQL */ `
  mutation DeleteUser(
    $input: DeleteUserInput!
    $condition: ModelUserConditionInput
  ) {
    deleteUser(input: $input, condition: $condition) {
      id
      username
      email
      displayName
      avatarUrl
      createdAt
      updatedAt
      __typename
    }
  }
`;
