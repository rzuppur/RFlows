<template lang="pug" functional>

  button.button-reset.chat(
    @click="() => { props.action && props.action(); }"
    :aria-label="props.chat && props.chat.name"
    :class="[data.staticClass, { \
      unread: !!(props.chat && props.chat.unread), \
      active: (props.chat && props.chat.id === props.store.currentChatId), \
      recent: props.chat && props.chat.props && props.chat.props['1h_itemcount'] \
    }]"
    :style="[data.style, data.staticStyle]"
  )

    .chat-title.r-ellipsis(v-if="props.chat && props.chat.name") {{ props.store.EMOJIFY[props.chat.id] }} {{ props.chat.name }}
    .chat-title.r-ellipsis.placeholder(v-else :style="{ maxWidth: `${120 + 50*(data.key*999999.8 % 2.4)}px` }")

    .chat-flagged(v-if="props.chat && props.chat.flagged > 0")
      r-icon.icon-text.blue(icon="pin" style="opacity: 0.5;")

    .chat-removerecent(v-if="props.recentRemove && props.chat" @click.stop="props.recentRemove(props.chat.id)")
      r-icon.icon-text.white(icon="close")

    .chat-unread.counter(v-if="props.chat" :class="{ important: !!props.chat.unreadImportant, atme: !!props.chat.unreadAtme }")
      | {{ (!!props.chat.unreadAtme ? '@' : '') + props.chat.unread }}

</template>

<style lang="stylus" scoped>
  @import "~@/shared.styl"

  .chat
    $chat-height = 28px
    display flex
    height $chat-height
    font-sans($font-size-normal)
    padding 0 10px
    color $color-gray-text-light
    align-items center
    cursor pointer

    @media (max-width $media-mobile-width)
      height 40px
      font-sans($font-size-medium-1)

    &.unread
      color #fff
      font-sans($font-size-normal, $font-weight-sans-bold)

      @media (max-width $media-mobile-width)
        font-sans($font-size-medium-1, $font-weight-sans-bold)

      .chat-unread
        display block

      &.recent:not(.active)
        background alpha($color-yellow, 0.08)

    &:hover
      background rgba(255, 255, 255, 0.05)

      &.recentChat:not(.unread)
        .chat-unread
          display none

        .chat-removerecent
          display block

    &.active
      background $color-blue
      color #fff

    .chat-title
      flex 1

      &.placeholder
        background alpha(#fff, .1)
        margin-right 40px
        height 13px
        border-radius @height

    .chat-removerecent
      display none
      align-self center
      padding 0 5px 0
      margin-right -10px
      height $chat-height

      &:hover
        background rgba(255,255,255,0.1)

      .fa
        font-size 12px
        color #fff
        opacity 0.5
        line-height $chat-height

    .chat-flagged
      font-size 13px
      font-weight $font-weight-sans-bold
      color alpha($color-blue, 0.6)
      margin-left 5px
      white-space nowrap

      i
        position relative
        top 1px

    .chat-unread
      display none

      &.important
        background alpha($color-red, 0.35)

        &.atme
          background $color-red

    &.active
      .chat-unread,
      .chat-unread.atme
        background rgba(0, 0, 0, 0.2)

</style>
