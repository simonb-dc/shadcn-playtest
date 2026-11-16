import type { ReactNode } from 'react'
import { BellIcon, FileTextIcon, ImageIcon, PlusIcon, TriangleAlertIcon, SmileIcon } from 'lucide-react'
import './demo.css'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AspectRatio } from '@/components/ui/aspect-ratio'
import {
  Attachment, AttachmentAction, AttachmentActions, AttachmentContent, AttachmentDescription,
  AttachmentMedia, AttachmentTitle, AttachmentTrigger,
} from '@/components/ui/attachment'
import {
  Avatar, AvatarBadge, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage,
} from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb, BreadcrumbEllipsis, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Bubble, BubbleContent, BubbleGroup, BubbleReactions } from '@/components/ui/bubble'
import { Button } from '@/components/ui/button'
import { ButtonGroup, ButtonGroupText } from '@/components/ui/button-group'
import { Calendar } from '@/components/ui/calendar'

/**
 * Forced pseudo-states (hover / focus-visible / active) cannot be set from markup.
 * The element under test carries data-force="<pseudo>" so a harness can apply it with
 * CDP CSS.forcePseudoState (real browser pseudo-state, not a mocked class).
 * disabled / aria-invalid / aria-expanded / open etc. are real attributes set below.
 */
type Force = 'hover' | 'focus-visible' | 'active' | 'focus-within'
const force = (s: string): { 'data-force'?: Force } =>
  s === 'hover' || s === 'focus-visible' || s === 'active' || s === 'focus-within' ? { 'data-force': s } : {}

function Cell({ id, fixed, children }: { id: string; fixed?: boolean; children: ReactNode }) {
  return (
    <figure className="demo-cell">
      <figcaption>{id}</figcaption>
      <div className="demo-item" data-demo={id} data-w={fixed ? 'fixed' : undefined}>
        {children}
      </div>
    </figure>
  )
}

function Section({ title, cols = 4, note, children }: { title: string; cols?: number; note?: string; children: ReactNode }) {
  return (
    <section data-section={title}>
      <h2>{title}</h2>
      {note && <p className="demo-note">{note}</p>}
      <div className="demo-grid" style={{ ['--cols' as string]: cols }}>{children}</div>
    </section>
  )
}

const IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' fill='#8b5cf6'/><circle cx='32' cy='26' r='12' fill='#fff'/><rect x='12' y='42' width='40' height='22' rx='11' fill='#fff'/></svg>",
  )

const cross = <A, B, C>(a: readonly A[], b: readonly B[], c: readonly C[]) => a.flatMap((x) => b.flatMap((y) => c.map((z) => [x, y, z] as const)))

export default function DemoPage() {
  const buttonVariants = ['default', 'outline', 'secondary', 'ghost', 'destructive', 'link'] as const
  const buttonSizes = ['default', 'xs', 'sm', 'lg', 'icon', 'icon-xs', 'icon-sm', 'icon-lg'] as const
  const buttonStates = ['default', 'hover', 'focus-visible', 'active', 'disabled'] as const
  const badgeVariants = ['default', 'secondary', 'destructive', 'outline', 'ghost', 'link'] as const
  const bubbleVariants = ['default', 'secondary', 'muted', 'tinted', 'outline', 'ghost', 'destructive'] as const
  const jan = new Date(2025, 0, 1)
  const dialogParam = new URLSearchParams(window.location.search).get('dialog')

  return (
    <main className="demo-page">
      <h1>/demo — shadcn base-nova reference</h1>
      <p className="demo-note">
        Every item is wrapped in [data-demo="component/variant/size/state"]. Forced pseudo-states are tagged
        data-force on the element under test (apply with CDP forcePseudoState). Add ?theme=dark for dark.
      </p>

      <Section title="button" cols={4}>
        {cross(buttonVariants, buttonSizes, buttonStates).map(([v, s, st]) => (
          <Cell key={`${v}${s}${st}`} id={`button/${v}/${s}/${st}`}>
            <Button variant={v} size={s} disabled={st === 'disabled'} {...force(st)}>
              {s.startsWith('icon') ? <PlusIcon /> : 'Button'}
            </Button>
          </Cell>
        ))}
        {(['default', 'invalid'] as const).map((st) => (
          <Cell key={st} id={`button/outline/default/${st === 'invalid' ? 'aria-invalid' : 'default-with-icon'}`}>
            <Button variant="outline" aria-invalid={st === 'invalid' || undefined}>
              {st === 'default' && <PlusIcon data-icon="inline-start" />}Button
            </Button>
          </Cell>
        ))}
      </Section>

      <Section title="badge" cols={4}>
        {cross(badgeVariants, ['default'], ['default', 'hover', 'aria-invalid']).map(([v, s, st]) => (
          <Cell key={`${v}${st}`} id={`badge/${v}/${s}/${st}`}>
            <Badge
              variant={v}
              aria-invalid={st === 'aria-invalid' || undefined}
              {...(st === 'hover' ? { render: <a href="#" /> } : {})}
              {...force(st)}
            >
              Badge
            </Badge>
          </Cell>
        ))}
        <Cell id="badge/default/default/with-icon">
          <Badge><BellIcon data-icon="inline-start" />Badge</Badge>
        </Cell>
      </Section>

      <Section title="avatar" cols={4}>
        {(['sm', 'default', 'lg'] as const).flatMap((s) => [
          <Cell key={`i${s}`} id={`avatar/image/${s}/default`}>
            <Avatar size={s}><AvatarImage src={IMG} alt="" /><AvatarFallback>CN</AvatarFallback></Avatar>
          </Cell>,
          <Cell key={`f${s}`} id={`avatar/fallback/${s}/default`}>
            <Avatar size={s}><AvatarFallback>CN</AvatarFallback></Avatar>
          </Cell>,
          <Cell key={`b${s}`} id={`avatar/image/${s}/badge`}>
            <Avatar size={s}><AvatarImage src={IMG} alt="" /><AvatarFallback>CN</AvatarFallback><AvatarBadge /></Avatar>
          </Cell>,
          <Cell key={`g${s}`} id={`avatar-group/default/${s}/default`}>
            <AvatarGroup>
              <Avatar size={s}><AvatarImage src={IMG} alt="" /><AvatarFallback>A</AvatarFallback></Avatar>
              <Avatar size={s}><AvatarFallback>B</AvatarFallback></Avatar>
              <AvatarGroupCount>+3</AvatarGroupCount>
            </AvatarGroup>
          </Cell>,
        ])}
      </Section>

      <Section title="alert" cols={3}>
        {(['default', 'destructive'] as const).flatMap((v) => [
          <Cell key={`a${v}`} id={`alert/${v}/default/title-description`} fixed>
            <Alert variant={v}><AlertTitle>Heads up</AlertTitle><AlertDescription>You can add components to your app.</AlertDescription></Alert>
          </Cell>,
          <Cell key={`b${v}`} id={`alert/${v}/default/icon`} fixed>
            <Alert variant={v}><TriangleAlertIcon /><AlertTitle>Heads up</AlertTitle><AlertDescription>You can add components to your app.</AlertDescription></Alert>
          </Cell>,
          <Cell key={`c${v}`} id={`alert/${v}/default/action`} fixed>
            <Alert variant={v}><AlertTitle>Heads up</AlertTitle><AlertDescription>You can add components to your app.</AlertDescription><AlertAction><Button variant="outline" size="xs">Undo</Button></AlertAction></Alert>
          </Cell>,
        ])}
      </Section>

      <Section title="accordion" cols={3}>
        {[
          ['collapsed', undefined, false],
          ['expanded', ['a'], false],
          ['disabled', undefined, true],
          ['hover', undefined, false],
          ['focus-visible', undefined, false],
        ].map(([st, open, dis]) => (
          <Cell key={st as string} id={`accordion/default/default/${st}`} fixed>
            <Accordion defaultValue={open as string[] | undefined}>
              <AccordionItem value="a" disabled={dis as boolean}>
                <AccordionTrigger {...force(st as string)}>Is it accessible?</AccordionTrigger>
                <AccordionContent>Yes. It adheres to the WAI-ARIA design pattern.</AccordionContent>
              </AccordionItem>
            </Accordion>
          </Cell>
        ))}
      </Section>

      <Section title="breadcrumb" cols={3}>
        <Cell id="breadcrumb/default/default/default" fixed>
          <Breadcrumb><BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink href="#">Home</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbLink href="#">Components</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>Breadcrumb</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList></Breadcrumb>
        </Cell>
        <Cell id="breadcrumb/default/default/ellipsis" fixed>
          <Breadcrumb><BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink href="#">Home</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbEllipsis /></BreadcrumbItem><BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>Breadcrumb</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList></Breadcrumb>
        </Cell>
        <Cell id="breadcrumb/default/default/link-hover" fixed>
          <Breadcrumb><BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink href="#" {...force('hover')}>Home</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>Breadcrumb</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList></Breadcrumb>
        </Cell>
      </Section>

      <Section title="button-group" cols={4}>
        {(['horizontal', 'vertical'] as const).flatMap((o) => [
          <Cell key={`b${o}`} id={`button-group/${o}/default/default`}>
            <ButtonGroup orientation={o}><Button variant="outline">One</Button><Button variant="outline">Two</Button><Button variant="outline">Three</Button></ButtonGroup>
          </Cell>,
          <Cell key={`t${o}`} id={`button-group/${o}/default/with-text`}>
            <ButtonGroup orientation={o}><ButtonGroupText>Label</ButtonGroupText><Button variant="outline">Action</Button></ButtonGroup>
          </Cell>,
          <Cell key={`d${o}`} id={`button-group/${o}/default/disabled`}>
            <ButtonGroup orientation={o}><Button variant="outline" disabled>One</Button><Button variant="outline" disabled>Two</Button></ButtonGroup>
          </Cell>,
          <Cell key={`f${o}`} id={`button-group/${o}/default/focus-visible`}>
            <ButtonGroup orientation={o}><Button variant="outline">One</Button><Button variant="outline" {...force('focus-visible')}>Two</Button></ButtonGroup>
          </Cell>,
        ])}
      </Section>

      <Section
        title="alert-dialog"
        cols={4}
        note="Content portals to <body> as a fixed overlay, so it cannot sit in a grid. Closed = trigger. Open: /demo?dialog=default or ?dialog=sm (data-demo is on the popup element)."
      >
        {(['default', 'sm'] as const).map((size) => (
          <Cell key={size} id={`alert-dialog/default/${size}/${dialogParam === size ? 'open' : 'closed'}`}>
            <AlertDialog defaultOpen={dialogParam === size}>
              <AlertDialogTrigger render={<Button variant="outline" />}>Open dialog</AlertDialogTrigger>
              <AlertDialogContent size={size} {...(dialogParam === size ? { 'data-demo': `alert-dialog/default/${size}/open-popup` } : {})}>
                <AlertDialogHeader>
                  <AlertDialogMedia><BellIcon /></AlertDialogMedia>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction>Continue</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Cell>
        ))}
      </Section>

      <Section title="aspect-ratio" cols={4}>
        {[['1:1', 1], ['4:3', 4 / 3], ['16:9', 16 / 9], ['9:16', 9 / 16]].map(([n, r]) => (
          <Cell key={n as string} id={`aspect-ratio/${(n as string).replace(':', '-')}/default/default`} fixed>
            <div style={{ width: r === 9 / 16 ? 120 : 288 }}>
              <AspectRatio ratio={r as number}>
                <img src={IMG} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </AspectRatio>
            </div>
          </Cell>
        ))}
      </Section>

      <Section title="attachment" cols={4}>
        {cross(['horizontal', 'vertical'] as const, ['icon', 'image'] as const, ['default', 'sm', 'xs'] as const).flatMap(([o, m, s]) =>
          (['idle', 'uploading', 'processing', 'error', 'done'] as const).map((st) => (
            <Cell key={`${o}${m}${s}${st}`} id={`attachment/${o}-${m}/${s}/${st}`}>
              <Attachment orientation={o} size={s} state={st}>
                <AttachmentMedia variant={m}>
                  {m === 'image' ? <img src={IMG} alt="" /> : <FileTextIcon />}
                </AttachmentMedia>
                <AttachmentContent><AttachmentTitle>report.pdf</AttachmentTitle><AttachmentDescription>2.4 MB</AttachmentDescription></AttachmentContent>
                {o === 'horizontal' && <AttachmentActions><AttachmentAction aria-label="Remove"><PlusIcon /></AttachmentAction></AttachmentActions>}
              </Attachment>
            </Cell>
          )),
        )}
        {(['hover', 'focus-within'] as const).map((st) => (
          <Cell key={st} id={`attachment/horizontal-icon/default/trigger-${st}`}>
            <Attachment {...force(st)}>
              <AttachmentMedia><FileTextIcon /></AttachmentMedia>
              <AttachmentContent><AttachmentTitle>report.pdf</AttachmentTitle><AttachmentDescription>2.4 MB</AttachmentDescription></AttachmentContent>
              <AttachmentTrigger aria-label="Open" />
            </Attachment>
          </Cell>
        ))}
        <Cell id="attachment/horizontal-icon/default/media-only"><Attachment><AttachmentMedia><ImageIcon /></AttachmentMedia></Attachment></Cell>
      </Section>

      <Section title="bubble" cols={2}>
        {cross(bubbleVariants, ['start', 'end'] as const, ['static', 'button', 'button-hover', 'reactions'] as const).map(([v, a, st]) => (
          <Cell key={`${v}${a}${st}`} id={`bubble/${v}/${a}/${st}`} fixed>
            <BubbleGroup>
              <Bubble variant={v} align={a}>
                <BubbleContent
                  {...(st === 'button' || st === 'button-hover' ? { render: <button type="button" /> } : {})}
                  {...(st === 'button-hover' ? force('hover') : {})}
                >
                  Hello, how are you?
                </BubbleContent>
                {st === 'reactions' && <BubbleReactions align={a}><SmileIcon /></BubbleReactions>}
              </Bubble>
            </BubbleGroup>
          </Cell>
        ))}
      </Section>

      <Section title="calendar" cols={3}>
        <Cell id="calendar/single/default/default" fixed><Calendar mode="single" defaultMonth={jan} /></Cell>
        <Cell id="calendar/single/default/selected" fixed><Calendar mode="single" defaultMonth={jan} selected={new Date(2025, 0, 15)} /></Cell>
        <Cell id="calendar/range/default/selected" fixed><Calendar mode="range" defaultMonth={jan} selected={{ from: new Date(2025, 0, 10), to: new Date(2025, 0, 16) }} /></Cell>
        <Cell id="calendar/single/default/disabled-days" fixed><Calendar mode="single" defaultMonth={jan} disabled={{ dayOfWeek: [0, 6] }} /></Cell>
        <Cell id="calendar/single/dropdown/default" fixed><Calendar mode="single" defaultMonth={jan} captionLayout="dropdown" startMonth={new Date(2020, 0)} endMonth={new Date(2030, 11)} /></Cell>
        <Cell id="calendar/single/outline-nav/default" fixed><Calendar mode="single" defaultMonth={jan} buttonVariant="outline" /></Cell>
      </Section>
    </main>
  )
}
