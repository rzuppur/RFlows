<template lang="pug">

  .user(
    v-if="user"
    :class="{ 'user-with-name': withName, outside: user.role === 'NOTIFICATION_RECEIVER' }"
    :status="user.userStatus"
  )

    slot(name="avatar")
      .avatar-container(v-if="user.avatar")
        img.avatar.avatar-small(:src="user.avatar" :status="user.status" v-rtip.bottom="tooltip")
        .online-status
        .unreads(v-if="user.unreadItemsCount") {{ user.role === 'NOTIFICATION_RECEIVER' ? '@' : user.unreadItemsCount }}

    .text(v-if="withName")
      .name.r-ellipsis {{ user.name }}
      .details.r-ellipsis(v-if="user.email") {{ user.email }}
      .details.r-ellipsis(v-else-if="user.role")
        span(v-if="userStatus") {{ userStatus ? userStatus : "" }}
        span(v-if="user.role === 'ADMIN'") &nbsp;· Admin

    slot

</template>

<script>
  export default {
    name: "UserDisplay",
    props: {
      user: {
        type: Object,
      },
      withName: {
        type: Boolean,
        default: false,
      },
    },
    computed: {
      userStatus() {
        if (this.user.userStatus) return this.user.userStatus.charAt(0) + this.user.userStatus.toLowerCase().substr(1);
        return false;
      },
      tooltip() {
        if (!this.withName && this.user.name) {
          if (this.user.role) {
            if (this.userStatus) return `${this.user.name} · ${this.userStatus}${this.user.role === "ADMIN" ? " · Admin" : ""}`;
            return `${this.user.name} (${this.user.role.toLowerCase()})`;
          }
          return this.user.name;
        }
        return null;
      },
    },
  };

</script>

<style lang="stylus" scoped>
  @import "~@/shared.styl"

  .user
    font-sans($font-size-small)
    min-width 40px

    &[status="OFFLINE"] .avatar
      opacity 0.5
      filter saturate(0)

    .avatar-container
      position relative
      height 40px

    .online-status
      width 10px
      height @width
      border-radius 50%
      position absolute
      right -3px
      top -2px
      display none
      border 2px solid #fff

      .darkMode &
        border-color $color-background-3-darkmode

    &[status="AWAY"]
      .online-status
        background #ffc843
        display block

    &[status="ONLINE"]
      .online-status
        background #83c844
        display block

      .avatar[status="OPEN"],
      .avatar[status="TYPING"]
        box-shadow 0 0 0 1px #fff, 0 0 0 3px #83c843

        .darkMode &
          box-shadow 0 0 0 1.5px $color-background-3-darkmode, 0 0 0 3px #83c843

    .avatar
      margin 0 0 0 10px

    &.user-with-name .avatar
      margin 0 10px 0 0

    .unreads
      position absolute
      bottom -2px
      right -4px
      padding 0 4px
      font-sans($font-size-small, $font-weight-sans-bold)
      background $color-blue
      color #fff
      text-shadow 0 -1px rgba(0, 0, 0, 0.5)
      border-radius $border-radius

    &.outside .unreads
      background $color-red
      font-feature-settings "case"
      padding 0 3px
      font-size 90%

    .details
      color $color-gray-text
      font-sans($font-size-small)

      .darkMode &
        color $color-text-quiet-darkmode

</style>
