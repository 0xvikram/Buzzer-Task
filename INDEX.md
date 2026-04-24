# 📚 Buzzer Task: Complete Training Package

**Everything you need to understand, master, and interview about your Buzzer backend codebase.**

---

## 📖 What's Included

I've created **5 comprehensive guides** + **this index** to help you deeply understand your AWS Amplify project.

### The 5 Guides

#### 1. **[LEARNING_SUMMARY.md](LEARNING_SUMMARY.md)** ⭐ START HERE
- Quick overview of what you've built
- 4 training guides explained
- Recommended learning paths (4hr, 8hr, 12hr)
- Key concepts at a glance
- Success criteria checklist

#### 2. **[INTERVIEW_PREP.md](INTERVIEW_PREP.md)** 💼 FOR INTERVIEWS
14 interview questions you should be able to answer:
- Q1: Data model design
- Q2: Authorization strategy
- Q3: Why SQS instead of inline
- Q4: How subscriptions work
- Q5: Lambda IAM authorization
- Q6: Idempotency in async
- Q7: Signup/login flow
- Q8: OpenSearch integration
- Q9: Worst-case failures
- Q10: Multi-tenancy design
- Q11: Monitoring
- Q12: What would you do differently
- Q13: Testing approach
- Q14: Security concerns

#### 3. **[AWS_CONSOLE_GUIDE.md](AWS_CONSOLE_GUIDE.md)** 🖥️ NAVIGATE AWS
Step-by-step guide to see your deployed infrastructure:
- Cognito: View users, triggers
- DynamoDB: Browse tables, query with GSI
- AppSync: Test mutations in explorer
- Lambda: View logs and metrics
- SQS: Monitor queue
- CloudFormation: See all resources
- CloudWatch: View logs from all services
- IAM: Understand permissions
- Plus: Debugging workflow

#### 4. **[HANDS_ON_EXERCISES.md](HANDS_ON_EXERCISES.md)** 🛠️ LEARN BY DOING
10 practical exercises + challenge:
1. Deploy, test, verify
2. Understand auth flow
3. Trace mutation through all layers
4. Intentionally break things
5. Query data different ways
6. Understand subscriptions
7. Error handling
8. Learn codebase structure
9. Add new field to schema
10. Deep dive into one resolver
11. **Challenge:** Create unfollowUser mutation

#### 5. **[AWS_TERMINOLOGY_GUIDE.md](AWS_TERMINOLOGY_GUIDE.md)** 📚 AWS REFERENCE
Comprehensive reference for AWS services:
- 9 AWS services explained
- Common terminology (ARN, region, stack, etc.)
- Cost estimation
- Security best practices
- Troubleshooting checklist
- FAQ

#### 6. **[ARCHITECTURE_GUIDE.md](/memories/session/buzzer_architecture_guide.md)** 🏗️ SYSTEM DESIGN
(In session memory) Full architecture including:
- Project overview
- Entry point & user flows
- AWS services explained
- Data models
- Resolver pipeline
- Authorization models
- Full request trace example
- Common issues & debugging

---

## 🚀 Quick Start: How to Use These Guides

### For the Next 4 Hours (Minimum Deep Dive)

```
Hour 1: Architecture
├─ Read: LEARNING_SUMMARY.md (all sections)
└─ Read: AWS_TERMINOLOGY_GUIDE.md (Cognito, AppSync, DynamoDB sections)

Hour 2: Console Exploration
├─ Read: AWS_CONSOLE_GUIDE.md (sections 1-2: Cognito & DynamoDB)
├─ Open: AWS Console → Cognito → Find your test users
└─ Open: AWS Console → DynamoDB → Browse BuzzerUsers table

Hour 3: Deploy & Test
├─ Run: amplify push
├─ Run: node test/run-demo.mjs
├─ Do: HANDS_ON_EXERCISES Exercise 1-2
└─ Verify: Data appears in DynamoDB

Hour 4: Code Deep Dive
├─ Read: schema.graphql (understand all types & operations)
├─ Read: Mutation.requestFollow.js (understand request/response)
├─ Do: HANDS_ON_EXERCISES Exercise 10 (deep dive resolver)
└─ Trace: One mutation end-to-end
```

**After 4 hours:** You understand the architecture, can navigate the console, and understand one complete mutation.

---

### For Full Day (8 Hours)

Follow the 4-hour path above, then:

```
Hour 5: Advanced Concepts
├─ Read: INTERVIEW_PREP.md (Q3, Q4, Q5 on SQS, subscriptions, IAM)
├─ Do: HANDS_ON_EXERCISES Exercise 3 (trace mutation)
└─ Watch: CloudWatch logs in real-time as mutation runs

Hour 6: Break Things, Learn Debugging
├─ Do: HANDS_ON_EXERCISES Exercise 4 (intentionally break things)
├─ Learn: How errors appear in CloudWatch
└─ Understand: Error recovery patterns

Hour 7: Make Changes
├─ Do: HANDS_ON_EXERCISES Exercise 9 (add field to schema)
├─ Deploy: amplify push
└─ Verify: Field works in GraphQL

Hour 8: Create Your Own
├─ Do: HANDS_ON_EXERCISES Challenge (create unfollowUser mutation)
├─ Implement: All necessary pieces (resolver, SQS, Lambda)
└─ Test: End-to-end
```

**After 8 hours:** You can make changes to the system with confidence.

---

### For Interview Preparation (12 Hours over 3 Days)

**Day 1 (4 hours):**
```
Read INTERVIEW_PREP.md Q1-Q7 (with AWS_TERMINOLOGY_GUIDE as reference)
Do HANDS_ON_EXERCISES 1-3
Navigate AWS Console for real data
```

**Day 2 (4 hours):**
```
Read INTERVIEW_PREP.md Q8-Q14
Do HANDS_ON_EXERCISES 9-10
Do HANDS_ON_EXERCISES Challenge
Explain architecture to colleague (out loud)
```

**Day 3 (4 hours):**
```
Answer INTERVIEW_PREP Q1-Q14 without reading answers
Time yourself: 20 minutes total for all 14
Do HANDS_ON_EXERCISES 4 (debugging practice)
Review AWS_CONSOLE_GUIDE for quick reference
Write down tradeoffs and design decisions
```

**After 12 hours:** You're interview-ready with deep understanding.

---

## 📋 Topics by Guide

### If you're interested in...

**Authorization & Security:**
→ INTERVIEW_PREP.md Q2 & Q14
→ AWS_CONSOLE_GUIDE.md Section 8 (IAM)
→ AWS_TERMINOLOGY_GUIDE.md (IAM section)

**Async Processing & Resilience:**
→ INTERVIEW_PREP.md Q3 & Q9
→ HANDS_ON_EXERCISES Exercise 7 (error handling)
→ AWS_TERMINOLOGY_GUIDE.md (SQS & Lambda sections)

**Data Modeling:**
→ INTERVIEW_PREP.md Q1
→ HANDS_ON_EXERCISES Exercise 5 (query data)
→ AWS_TERMINOLOGY_GUIDE.md (DynamoDB section)

**Real-time & Subscriptions:**
→ INTERVIEW_PREP.md Q4
→ HANDS_ON_EXERCISES Exercise 6 (subscriptions)
→ AWS_CONSOLE_GUIDE.md Section 3 (AppSync)

**Making Changes & Adding Features:**
→ HANDS_ON_EXERCISES Exercise 9 (add field)
→ HANDS_ON_EXERCISES Challenge (create mutation)
→ AWS_CONSOLE_GUIDE.md (test in AppSync explorer)

**Debugging Production Issues:**
→ AWS_CONSOLE_GUIDE.md (debugging workflow)
→ AWS_CONSOLE_GUIDE.md Section 7 (CloudWatch)
→ HANDS_ON_EXERCISES Exercise 4 (break things)

**System Design at Scale:**
→ INTERVIEW_PREP.md Q10 & Q12
→ AWS_TERMINOLOGY_GUIDE.md (cost estimation)
→ INTERVIEW_PREP.md Q9 (failure scenarios)

---

## 🎯 Your Learning Checklist

### Architecture Understanding
- [ ] Read LEARNING_SUMMARY.md (overview)
- [ ] Read INTERVIEW_PREP.md Q1-Q2 (data model & auth)
- [ ] Read AWS_TERMINOLOGY_GUIDE.md (AWS services)
- [ ] Can explain 3-layer authorization
- [ ] Can trace request end-to-end

### Hands-On Experience
- [ ] Deploy project (amplify push)
- [ ] Run test script (node test/run-demo.mjs)
- [ ] Navigate AWS Console (Cognito, DynamoDB, AppSync, Lambda)
- [ ] Query data in DynamoDB console
- [ ] Test mutation in AppSync explorer
- [ ] View logs in CloudWatch

### Code Comprehension
- [ ] Read schema.graphql
- [ ] Read Mutation.requestFollow.js (understand each line)
- [ ] Read postConfirmationTrigger Lambda
- [ ] Read notificationProcessor Lambda
- [ ] Understand resolver pipeline

### Making Changes
- [ ] Add field to schema (Exercise 9)
- [ ] Create new mutation (Challenge)
- [ ] Deploy changes successfully
- [ ] Test in console

### Interview Ready
- [ ] Answer Q1-Q14 without reading
- [ ] Explain tradeoffs and why
- [ ] Handle tough questions gracefully
- [ ] Have concrete examples ready

---

## 🔍 Quick Answer Guide

**Q: What's this system?**
A: Social app backend. Users signup, follow each other, get notifications. Async processing for resilience.

**Q: How does auth work?**
A: Cognito for identity. Three-layer authorization: GraphQL decorator, resolver check, DynamoDB condition.

**Q: Why SQS?**
A: Decouples mutations from notifications. If notification fails, follow still succeeded. Retries automatic.

**Q: How do subscriptions work?**
A: GraphQL WebSocket subscription. Resolver filters by caller ID. Only receive events meant for them.

**Q: Cost at 10k users?**
A: ~$150-200/month mostly Cognito. DynamoDB + Lambda very cheap. Scales well.

**Q: What about 1M users?**
A: Switch to provisioned capacity, add caching, use OpenSearch for search, consider sharding.

**Q: How do you test this?**
A: `node test/run-demo.mjs` for end-to-end. AppSync explorer for manual testing.

---

## 📚 Recommended Reading Order

1. **Start here:** LEARNING_SUMMARY.md (10 min)
2. **Big picture:** INTERVIEW_PREP.md Q1-Q2 (15 min)
3. **AWS fundamentals:** AWS_TERMINOLOGY_GUIDE.md (20 min)
4. **Navigate live system:** AWS_CONSOLE_GUIDE.md (30 min)
5. **Deep dive:** INTERVIEW_PREP.md Q3-Q5 (20 min)
6. **Hands-on:** HANDS_ON_EXERCISES 1-3 (90 min)
7. **Code:** Read all resolver files (60 min)
8. **Prepare:** INTERVIEW_PREP.md Q6-Q14 (30 min)
9. **Practice:** HANDS_ON_EXERCISES 4-10 (120 min)

**Total:** ~5 hours structured learning + practice

---

## 🎓 Success Indicators

You've mastered this when you can:

- [ ] Explain the system to a non-technical friend (5 minutes)
- [ ] Explain the system to a senior engineer (20 minutes with questions)
- [ ] Answer any of the 14 interview questions confidently
- [ ] Navigate AWS Console without help
- [ ] Read and modify any resolver
- [ ] Debug issues using CloudWatch logs
- [ ] Add a new feature end-to-end
- [ ] Explain why each technology choice was made
- [ ] Discuss tradeoffs and alternatives
- [ ] Estimate costs for scaling scenarios

---

## 🆘 Help! I'm Confused About...

### Authentication
→ INTERVIEW_PREP.md Q7 (full signup/login flow)
→ AWS_CONSOLE_GUIDE.md Section 1 (Cognito in console)

### Data Model
→ INTERVIEW_PREP.md Q1 (why designed this way)
→ HANDS_ON_EXERCISES Exercise 5 (query different ways)

### Async Notifications
→ INTERVIEW_PREP.md Q3 & Q6 (SQS + idempotency)
→ HANDS_ON_EXERCISES Exercise 3 (trace it)

### Authorization
→ INTERVIEW_PREP.md Q2 (three-layer model)
→ HANDS_ON_EXERCISES Exercise 4 (break auth)

### Real-time
→ INTERVIEW_PREP.md Q4 (subscriptions)
→ HANDS_ON_EXERCISES Exercise 6

### Code Changes
→ HANDS_ON_EXERCISES Exercise 9 (add field)
→ HANDS_ON_EXERCISES Challenge (new mutation)

### AWS Services
→ AWS_TERMINOLOGY_GUIDE.md (reference)

### Debugging
→ AWS_CONSOLE_GUIDE.md (full debugging section)
→ HANDS_ON_EXERCISES Exercise 4

---

## 🚀 Next Steps After Learning

### Week 1: Consolidate
- [ ] Complete all HANDS_ON_EXERCISES
- [ ] Answer INTERVIEW_PREP Q1-Q14 confidently
- [ ] Explain architecture to 3 people

### Week 2: Extend
- [ ] Implement OpenSearch integration (bonus)
- [ ] Add subscription WebSocket testing
- [ ] Add new features (unfollowUser, blockUser)

### Week 3: Polish
- [ ] Add unit tests
- [ ] Add CloudWatch alarms
- [ ] Document architecture decisions
- [ ] Prepare for interviews

### Interview Time
- [ ] Use INTERVIEW_PREP.md as study guide
- [ ] Practice explaining architecture (out loud)
- [ ] Have design tradeoffs ready
- [ ] Show confidence in what you've built

---

## 📞 Quick Reference

| Need | Where |
|------|-------|
| Interview prep | INTERVIEW_PREP.md |
| Navigate console | AWS_CONSOLE_GUIDE.md |
| Learn by doing | HANDS_ON_EXERCISES.md |
| AWS concepts | AWS_TERMINOLOGY_GUIDE.md |
| Full architecture | ARCHITECTURE_GUIDE.md (in memory) |
| Learning path | LEARNING_SUMMARY.md |

---

## 💡 Key Insights

### 1. Architecture is about tradeoffs
- SQS adds latency but gains resilience
- DynamoDB GSI adds schema complexity but enables fast queries
- Multiple auth layers add code but prevent bugs

### 2. Authorization is layered
- Never rely on a single auth check
- Enforce at API, resolver, and storage layers
- Defense in depth

### 3. Async processing is powerful
- Decouples concerns
- Enables scaling
- Retries automatic
- User experience improves

### 4. Careful data modeling pays off
- One bad design choice = expensive to fix later
- Think about access patterns up front
- Use GSI liberally

### 5. Cloud platforms are complex
- Many services, each with tradeoffs
- Learn principles, not just tools
- Tools change, principles don't

---

## ✅ Final Checklist Before Interview

- [ ] I understand the 3-layer authorization model
- [ ] I can trace a request end-to-end
- [ ] I know why SQS, not inline notification creation
- [ ] I understand DynamoDB GSI and access patterns
- [ ] I can explain why Cognito (not DIY auth)
- [ ] I know the cost breakdown
- [ ] I have 2-3 examples of design tradeoffs
- [ ] I can discuss scaling to 1M users
- [ ] I understand failure scenarios
- [ ] I'm confident explaining the system

---

## 🎉 You've Got This!

You've built something impressive. AWS Amplify, AppSync, DynamoDB, Lambda, and SQS are enterprise technologies. Understanding them deeply is valuable.

The guides are your training material. Use them. Reference them. Master them.

You're now an expert on this codebase.

Go ace that interview! 🚀

---

**Last updated:** April 23, 2026
**Created for:** Deep technical understanding of Buzzer backend
**Used for:** Interview preparation & system mastery

